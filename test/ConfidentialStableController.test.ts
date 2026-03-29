import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import hre from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { cofhejs, Encryptable, FheTypes } from 'cofhejs/node'

describe('ConfidentialStableController', function () {
	async function initializeSigner(signer: HardhatEthersSigner) {
		await hre.cofhe.expectResultSuccess(hre.cofhe.initializeWithHardhatSigner(signer))
	}

	async function encryptAmount(signer: HardhatEthersSigner, amount: bigint) {
		await initializeSigner(signer)
		const [encryptedAmount] = await hre.cofhe.expectResultSuccess(
			cofhejs.encrypt([Encryptable.uint128(amount)] as const),
		)
		return encryptedAmount
	}

	async function deployStableFixture() {
		const [owner, bob] = await hre.ethers.getSigners()

		const LPToken = await hre.ethers.getContractFactory('MockLPToken')
		const ethUsdcLp = await LPToken.connect(owner).deploy('ETH / fhUSDC LP', 'vLP-ETHUSDC')
		await ethUsdcLp.waitForDeployment()
		const daiUsdcLp = await LPToken.connect(owner).deploy('sDAI / fhUSDC LP', 'vLP-SDAIUSDC')
		await daiUsdcLp.waitForDeployment()

		const Stable = await hre.ethers.getContractFactory('VeilStablecoin')
		const stable = await Stable.connect(owner).deploy()
		await stable.waitForDeployment()

		const Controller = await hre.ethers.getContractFactory('ConfidentialStableController')
		const controller = await Controller.connect(owner).deploy(await stable.getAddress())
		await controller.waitForDeployment()

		await (await stable.connect(owner).setMinter(await controller.getAddress(), true)).wait()

		await (await controller.connect(owner).addCollateralType('ETH / fhUSDC', await ethUsdcLp.getAddress(), 250_000)).wait()
		await (await controller.connect(owner).addCollateralType('sDAI / fhUSDC', await daiUsdcLp.getAddress(), 120_000)).wait()

		await (await ethUsdcLp.connect(owner).mint(bob.address, 100n)).wait()
		await (await daiUsdcLp.connect(owner).mint(bob.address, 50n)).wait()

		await (await ethUsdcLp.connect(bob).approve(await controller.getAddress(), 100n)).wait()
		await (await daiUsdcLp.connect(bob).approve(await controller.getAddress(), 50n)).wait()

		return { owner, bob, ethUsdcLp, daiUsdcLp, stable, controller }
	}

	beforeEach(function () {
		if (!hre.cofhe.isPermittedEnvironment('MOCK')) this.skip()
	})

	it('mints encrypted stablecoin against selected LP collateral at a 160% ratio', async function () {
		const { bob, stable, controller } = await loadFixture(deployStableFixture)

		await (await controller.connect(bob).depositCollateral(0, 100n)).wait()
		await (await controller.connect(bob).depositCollateral(1, 50n)).wait()

		expect(await controller.collateralValueOf(bob.address)).to.equal(3_100n)

		await (await controller.connect(bob).mintStable(await encryptAmount(bob, 2_500n))).wait()

		await initializeSigner(bob)
		const encryptedStableBalance = await stable.encBalances(bob.address)
		const encryptedDebt = await controller.getEncryptedDebt(bob.address)

		const stableBalance = await cofhejs.unseal(encryptedStableBalance, FheTypes.Uint128)
		const debt = await cofhejs.unseal(encryptedDebt, FheTypes.Uint128)

		expect(stableBalance.success).to.equal(true)
		expect(stableBalance.data).to.equal(1_937n)
		expect(debt.success).to.equal(true)
		expect(debt.data).to.equal(1_937n)
	})

	it('tops up confidential debt only up to the remaining mint headroom', async function () {
		const { bob, stable, controller } = await loadFixture(deployStableFixture)

		await (await controller.connect(bob).depositCollateral(0, 100n)).wait()
		await (await controller.connect(bob).mintStable(await encryptAmount(bob, 1_000n))).wait()
		await (await controller.connect(bob).mintStable(await encryptAmount(bob, 1_000n))).wait()

		await initializeSigner(bob)
		const encryptedStableBalance = await stable.encBalances(bob.address)
		const stableBalance = await cofhejs.unseal(encryptedStableBalance, FheTypes.Uint128)

		expect(stableBalance.success).to.equal(true)
		expect(stableBalance.data).to.equal(1_562n)
	})
})
