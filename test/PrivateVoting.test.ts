import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import hre from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { cofhejs, Encryptable, FheTypes } from 'cofhejs/node'

describe('PrivateVoting', function () {
	async function initializeSigner(signer: HardhatEthersSigner) {
		await hre.cofhe.expectResultSuccess(hre.cofhe.initializeWithHardhatSigner(signer))
	}

	async function encryptVote(signer: HardhatEthersSigner, optionIndex: number) {
		await initializeSigner(signer)
		const [encryptedVote] = await hre.cofhe.expectResultSuccess(
			cofhejs.encrypt([Encryptable.uint8(BigInt(optionIndex))] as const),
		)
		return encryptedVote
	}

	async function deployPrivateVotingFixture() {
		const [owner, bob, alice, carol] = await hre.ethers.getSigners()
		const options = ['Sushi', 'Pizza', 'Tacos']

		const PrivateVoting = await hre.ethers.getContractFactory('PrivateVoting')
		const voting = await PrivateVoting.connect(owner).deploy()
		await voting.waitForDeployment()

		await (await voting.createProposal('Demo day lunch', options, 3600)).wait()

		return { voting, owner, bob, alice, carol, options, proposalId: 0n }
	}

	beforeEach(function () {
		if (!hre.cofhe.isPermittedEnvironment('MOCK')) this.skip()
	})

	it('keeps vote tallies private until the owner finalizes the proposal', async function () {
		const { voting, owner, bob, alice, carol, options, proposalId } =
			await loadFixture(deployPrivateVotingFixture)

		await voting.connect(bob).vote(proposalId, await encryptVote(bob, 0))
		await voting.connect(alice).vote(proposalId, await encryptVote(alice, 1))
		await voting.connect(carol).vote(proposalId, await encryptVote(carol, 0))

		expect(await voting.hasVoted(proposalId, bob.address)).to.equal(true)
		expect(await voting.hasVoted(proposalId, alice.address)).to.equal(true)
		expect(await voting.hasVoted(proposalId, carol.address)).to.equal(true)

		const proposal = await voting.getProposal(proposalId)
		expect(proposal[0]).to.equal('Demo day lunch')
		expect(proposal[2]).to.equal(false)
		expect(proposal[3]).to.deep.equal(options)

		await initializeSigner(bob)
		const hiddenHandle = await voting.getEncryptedVoteHandle(proposalId, 0)
		const hiddenUnseal = await cofhejs.unseal(hiddenHandle, FheTypes.Uint64)
		expect(hiddenUnseal.success).to.equal(false)
		expect(hiddenUnseal.error?.message).to.include('NotAllowed')

		await expect(voting.connect(owner).finalizeProposal(proposalId)).to.be.revertedWithCustomError(
			voting,
			'DeadlineNotReached',
		)

		await time.increase(3601)
		await (await voting.connect(owner).finalizeProposal(proposalId)).wait()

		const finalizedProposal = await voting.getProposal(proposalId)
		expect(finalizedProposal[2]).to.equal(true)

		await initializeSigner(alice)
		const tallyResults = await Promise.all(
			options.map(async (_, index) => {
				const handle = await voting.getEncryptedVoteHandle(proposalId, index)
				return cofhejs.unseal(handle, FheTypes.Uint64)
			}),
		)

		tallyResults.forEach((result) => {
			expect(result.success, result.success ? '' : result.error.message).to.equal(true)
		})

		const tallies = tallyResults.map((result) => result.data!)
		expect(tallies).to.deep.equal([2n, 1n, 0n])
	})

	it('rejects double voting and hides invalid encrypted indices as no-op updates', async function () {
		const { voting, bob, options, proposalId } = await loadFixture(deployPrivateVotingFixture)

		await voting.connect(bob).vote(proposalId, await encryptVote(bob, 99))

		await expect(voting.connect(bob).vote(proposalId, await encryptVote(bob, 1))).to.be.revertedWithCustomError(
			voting,
			'AlreadyVoted',
		)

		await time.increase(3601)
		await (await voting.finalizeProposal(proposalId)).wait()

		await initializeSigner(bob)
		const tallyResults = await Promise.all(
			options.map(async (_, index) => {
				const handle = await voting.getEncryptedVoteHandle(proposalId, index)
				return cofhejs.unseal(handle, FheTypes.Uint64)
			}),
		)

		tallyResults.forEach((result) => {
			expect(result.success, result.success ? '' : result.error.message).to.equal(true)
		})

		const tallies = tallyResults.map((result) => result.data!)
		expect(tallies).to.deep.equal([0n, 0n, 0n])
	})
})
