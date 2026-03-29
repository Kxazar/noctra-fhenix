import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import hre from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { cofhejs, Encryptable, FheTypes } from 'cofhejs/node'

describe('ConfidentialGaugeController', function () {
	async function initializeSigner(signer: HardhatEthersSigner) {
		await hre.cofhe.expectResultSuccess(hre.cofhe.initializeWithHardhatSigner(signer))
	}

	async function encryptGaugeVote(signer: HardhatEthersSigner, gaugeIndex: number) {
		await initializeSigner(signer)
		const [encryptedVote] = await hre.cofhe.expectResultSuccess(
			cofhejs.encrypt([Encryptable.uint8(BigInt(gaugeIndex))] as const),
		)
		return encryptedVote
	}

	async function deployProtocolFixture() {
		const [owner, bob, alice, carol] = await hre.ethers.getSigners()
		const gauges = [
			{ name: 'ETH / fhUSDC', label: 'volatile flagship pool' },
			{ name: 'wBTC / fhETH', label: 'blue-chip reserve route' },
			{ name: 'sDAI / fhUSDC', label: 'stable carry corridor' },
		]

		const VoteToken = await hre.ethers.getContractFactory('VeilToken')
		const token = await VoteToken.connect(owner).deploy()
		await token.waitForDeployment()

		const GaugeController = await hre.ethers.getContractFactory('ConfidentialGaugeController')
		const controller = await GaugeController.connect(owner).deploy(await token.getAddress(), 12_500n)
		await controller.waitForDeployment()

		for (const gauge of gauges) {
			await (await controller.connect(owner).registerGauge(gauge.name, gauge.label, owner.address)).wait()
		}

		await (await token.mint(bob.address, 1_000n)).wait()
		await (await token.mint(alice.address, 600n)).wait()
		await (await token.mint(carol.address, 400n)).wait()

		await (await token.connect(bob).approve(await controller.getAddress(), 1_000n)).wait()
		await (await token.connect(alice).approve(await controller.getAddress(), 600n)).wait()
		await (await token.connect(carol).approve(await controller.getAddress(), 400n)).wait()

		const year = 365 * 24 * 60 * 60
		await (await controller.connect(bob).lock(1_000n, BigInt(4 * year))).wait()
		await (await controller.connect(alice).lock(600n, BigInt(2 * year))).wait()
		await (await controller.connect(carol).lock(400n, BigInt(1 * year))).wait()

		return { owner, bob, alice, carol, token, controller, gauges, epochId: 0n }
	}

	beforeEach(function () {
		if (!hre.cofhe.isPermittedEnvironment('MOCK')) this.skip()
	})

	it('computes decaying ve voting power from locked balances', async function () {
		const { bob, alice, carol, controller } = await loadFixture(deployProtocolFixture)

		const bobPower = await controller.votingPowerOf(bob.address)
		const alicePower = await controller.votingPowerOf(alice.address)
		const carolPower = await controller.votingPowerOf(carol.address)

		expect(bobPower).to.be.gte(999n)
		expect(bobPower).to.be.lte(1_000n)
		expect(alicePower).to.be.gte(299n)
		expect(alicePower).to.be.lte(300n)
		expect(carolPower).to.be.gte(99n)
		expect(carolPower).to.be.lte(100n)

		await time.increase(365 * 24 * 60 * 60)

		const decayedBobPower = await controller.votingPowerOf(bob.address)
		const decayedAlicePower = await controller.votingPowerOf(alice.address)
		const decayedCarolPower = await controller.votingPowerOf(carol.address)

		expect(decayedBobPower).to.be.gte(749n)
		expect(decayedBobPower).to.be.lte(750n)
		expect(decayedAlicePower).to.be.gte(149n)
		expect(decayedAlicePower).to.be.lte(150n)
		expect(decayedCarolPower).to.equal(0n)
	})

	it('supports confidential wrapped balances through the Fhenix token flow', async function () {
		const { owner, bob, token } = await loadFixture(deployProtocolFixture)

		await (await token.connect(owner).mint(bob.address, 125n)).wait()

		await (await token.connect(bob).wrap(bob.address, 125n)).wait()

		await initializeSigner(bob)
		const encryptedBalance = await token.encBalances(bob.address)
		const result = await cofhejs.unseal(encryptedBalance, FheTypes.Uint128)

		expect(result.success).to.equal(true)
		expect(result.data).to.equal(125n)
		expect(await token.balanceOf(bob.address)).to.equal(0n)
	})

	it('keeps gauge weights private until the epoch is revealed', async function () {
		const { owner, bob, alice, carol, controller, gauges, epochId } = await loadFixture(deployProtocolFixture)

		const bobPower = await controller.votingPowerOf(bob.address)
		const alicePower = await controller.votingPowerOf(alice.address)
		const carolPower = await controller.votingPowerOf(carol.address)

		await (await controller.connect(bob).vote(epochId, await encryptGaugeVote(bob, 0))).wait()
		await (await controller.connect(alice).vote(epochId, await encryptGaugeVote(alice, 2))).wait()
		await (await controller.connect(carol).vote(epochId, await encryptGaugeVote(carol, 0))).wait()

		await initializeSigner(bob)
		const hiddenHandle = await controller.getEncryptedGaugeWeight(epochId, 0)
		const hiddenResult = await cofhejs.unseal(hiddenHandle, FheTypes.Uint128)
		expect(hiddenResult.success).to.equal(false)
		expect(hiddenResult.error?.message).to.include('NotAllowed')

		await time.increase(7 * 24 * 60 * 60 + 5)
		await (await controller.connect(owner).revealEpoch(epochId)).wait()

		await initializeSigner(owner)
		const weightResults = await Promise.all(
			gauges.map(async (_, index) => {
				const handle = await controller.getEncryptedGaugeWeight(epochId, index)
				return cofhejs.unseal(handle, FheTypes.Uint128)
			}),
		)

		weightResults.forEach((result) => {
			expect(result.success, result.success ? '' : result.error.message).to.equal(true)
		})

		const [gaugeZeroWeight, gaugeOneWeight, gaugeTwoWeight] = weightResults.map((result) => result.data!)
		expect(gaugeZeroWeight).to.be.gte(bobPower + carolPower - 2n)
		expect(gaugeZeroWeight).to.be.lte(bobPower + carolPower)
		expect(gaugeOneWeight).to.equal(0n)
		expect(gaugeTwoWeight).to.be.gte(alicePower - 1n)
		expect(gaugeTwoWeight).to.be.lte(alicePower)
		expect(await controller.epochEmission(epochId)).to.equal(12_500n)
	})

	it('rejects double voting in the same epoch', async function () {
		const { bob, controller, epochId } = await loadFixture(deployProtocolFixture)

		await (await controller.connect(bob).vote(epochId, await encryptGaugeVote(bob, 1))).wait()

		await expect(controller.connect(bob).vote(epochId, await encryptGaugeVote(bob, 2))).to.be.revertedWithCustomError(
			controller,
			'EpochAlreadyVoted',
		)
	})
})
