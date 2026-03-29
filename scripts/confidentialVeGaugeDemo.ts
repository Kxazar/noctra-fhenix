import hre from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { cofhejs, Encryptable, FheTypes } from 'cofhejs/node'

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

async function main() {
	if (!hre.cofhe.isPermittedEnvironment('MOCK')) {
		throw new Error('The demo is meant to run on the mock Hardhat environment.')
	}

	await hre.cofhe.mocks.deployMocks({
		deployTestBed: true,
		gasWarning: false,
		silent: true,
	})

	const [owner, bob, alice, carol] = await hre.ethers.getSigners()

	const VoteToken = await hre.ethers.getContractFactory('VeilToken')
	const token = await VoteToken.connect(owner).deploy()
	await token.waitForDeployment()

	const GaugeController = await hre.ethers.getContractFactory('ConfidentialGaugeController')
	const controller = await GaugeController.connect(owner).deploy(await token.getAddress(), 12_500n)
	await controller.waitForDeployment()

	const gauges = [
		{ name: 'ETH / fhUSDC', label: 'volatile flagship pool' },
		{ name: 'wBTC / fhETH', label: 'blue-chip reserve route' },
		{ name: 'sDAI / fhUSDC', label: 'stable carry corridor' },
	]

	for (const gauge of gauges) {
		await (await controller.registerGauge(gauge.name, gauge.label, owner.address)).wait()
	}

	await (await token.mint(bob.address, 1_120n)).wait()
	await (await token.mint(alice.address, 600n)).wait()
	await (await token.mint(carol.address, 400n)).wait()

	await (await token.connect(bob).approve(await controller.getAddress(), 1_000n)).wait()
	await (await token.connect(alice).approve(await controller.getAddress(), 600n)).wait()
	await (await token.connect(carol).approve(await controller.getAddress(), 400n)).wait()

	const year = 365 * 24 * 60 * 60
	await (await controller.connect(bob).lock(1_000n, BigInt(4 * year))).wait()
	await (await controller.connect(alice).lock(600n, BigInt(2 * year))).wait()
	await (await controller.connect(carol).lock(400n, BigInt(1 * year))).wait()

	await (await token.connect(bob).wrap(bob.address, 120n)).wait()
	await initializeSigner(bob)
	const encryptedBalance = await token.encBalances(bob.address)
	const revealedWrappedBalance = await hre.cofhe.expectResultSuccess(cofhejs.unseal(encryptedBalance, FheTypes.Uint128))

	console.log(`Protocol deployed at ${await controller.getAddress()}`)
	console.log(`Token deployed at ${await token.getAddress()}`)
	console.log(`Bob wrapped 120 VEIL into an encrypted balance: ${revealedWrappedBalance.toString()}`)
	console.log('Registered gauges:')
	gauges.forEach((gauge, index) => console.log(`- [${index}] ${gauge.name} :: ${gauge.label}`))

	const epochId = await controller.currentEpoch()
	await (await controller.connect(bob).vote(epochId, await encryptGaugeVote(bob, 0))).wait()
	await (await controller.connect(alice).vote(epochId, await encryptGaugeVote(alice, 2))).wait()
	await (await controller.connect(carol).vote(epochId, await encryptGaugeVote(carol, 0))).wait()
	console.log('Three ve voters submitted confidential gauge votes.')

	await initializeSigner(bob)
	const hiddenHandle = await controller.getEncryptedGaugeWeight(epochId, 0)
	const hiddenResult = await cofhejs.unseal(hiddenHandle, FheTypes.Uint128)
	if (hiddenResult.success) {
		throw new Error('Gauge weights should stay hidden before epoch reveal.')
	}
	console.log('Live gauge weights are still encrypted before reveal.')

	await hre.network.provider.send('evm_increaseTime', [7 * 24 * 60 * 60 + 5])
	await hre.network.provider.send('evm_mine')

	await (await controller.revealEpoch(epochId)).wait()
	console.log('Epoch revealed. Weekly emission budget:', (await controller.epochEmission(epochId)).toString())

	await initializeSigner(owner)
	const weights = await Promise.all(
		gauges.map(async (_, index) => {
			const handle = await controller.getEncryptedGaugeWeight(epochId, index)
			return hre.cofhe.expectResultSuccess(cofhejs.unseal(handle, FheTypes.Uint128))
		}),
	)

	const totalWeight = weights.reduce((sum, value) => sum + value, 0n)
	console.log('Revealed gauge weights:')
	for (const [index, weight] of weights.entries()) {
		const emissionShare = totalWeight === 0n ? 0n : (12_500n * weight) / totalWeight
		console.log(`- ${gauges[index].name}: weight=${weight.toString()} | emission=${emissionShare.toString()} VEIL`)
	}
}

main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})
