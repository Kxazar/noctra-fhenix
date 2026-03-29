import hre from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { cofhejs, Encryptable, FheTypes } from 'cofhejs/node'

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

async function decryptTally(
	signer: HardhatEthersSigner,
	contract: Awaited<ReturnType<typeof hre.ethers.getContractAt>>,
	proposalId: bigint,
	optionIndex: number,
) {
	await initializeSigner(signer)
	const handle = await contract.getEncryptedVoteHandle(proposalId, optionIndex)
	return hre.cofhe.expectResultSuccess(cofhejs.unseal(handle, FheTypes.Uint64))
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
	const options = ['Sushi', 'Pizza', 'Tacos']

	const PrivateVoting = await hre.ethers.getContractFactory('PrivateVoting')
	const voting = await PrivateVoting.connect(owner).deploy()
	await voting.waitForDeployment()

	console.log(`PrivateVoting deployed at ${await voting.getAddress()}`)

	const createTx = await voting.createProposal('Demo day lunch', options, 3600)
	await createTx.wait()

	const proposalId = 0n
	console.log(`Created proposal #${proposalId}: Demo day lunch`)
	console.log(`Options: ${options.join(', ')}`)

	await voting.connect(bob).vote(proposalId, await encryptVote(bob, 0))
	await voting.connect(alice).vote(proposalId, await encryptVote(alice, 1))
	await voting.connect(carol).vote(proposalId, await encryptVote(carol, 0))
	console.log('Three encrypted votes submitted.')

	await initializeSigner(bob)
	const hiddenHandle = await voting.getEncryptedVoteHandle(proposalId, 0)
	const hiddenResult = await cofhejs.unseal(hiddenHandle, FheTypes.Uint64)
	if (hiddenResult.success) {
		throw new Error('Tallies should stay private before finalization.')
	}
	console.log('Tallies are still private before finalization.')

	await hre.network.provider.send('evm_increaseTime', [3601])
	await hre.network.provider.send('evm_mine')

	await (await voting.finalizeProposal(proposalId)).wait()
	console.log('Proposal finalized. Tallies are now publicly unsealable off-chain.')

	const tallies = await Promise.all(options.map((_, index) => decryptTally(alice, voting, proposalId, index)))
	console.log('Decrypted tallies:')
	for (const [index, tally] of tallies.entries()) {
		console.log(`- ${options[index]}: ${tally.toString()} vote(s)`)
	}

	const winningIndex = tallies.reduce((bestIndex, current, index, values) =>
		current > values[bestIndex] ? index : bestIndex,
	0)
	console.log(`Winner: ${options[winningIndex]}`)
}

main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})
