// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, InEuint8, euint8, euint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract PrivateVoting {
    struct Option {
        string name;
        euint64 votes;
    }

    struct Proposal {
        string name;
        uint256 deadline;
        Option[] options;
        mapping(address => bool) hasVoted;
        bool exists;
        bool finalized;
    }

    error NotOwner();
    error ProposalNotFound();
    error InvalidOptionCount();
    error InvalidOptionIndex();
    error InvalidDuration();
    error AlreadyVoted();
    error DeadlinePassed();
    error DeadlineNotReached();
    error AlreadyFinalized();

    event ProposalCreated(uint256 indexed proposalId, string name, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter, euint8 encryptedOptionIndex);
    event ProposalFinalized(uint256 indexed proposalId);

    address public immutable owner;
    uint256 public proposalCount;

    euint64 private zeroValue;
    euint64 private oneValue;

    mapping(uint256 => Proposal) private proposals;

    constructor() {
        owner = msg.sender;
        zeroValue = FHE.asEuint64(0);
        oneValue = FHE.asEuint64(1);

        FHE.allowThis(zeroValue);
        FHE.allowThis(oneValue);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function createProposal(
        string memory name,
        string[] memory optionNames,
        uint256 durationSeconds
    ) external onlyOwner returns (uint256 proposalId) {
        if (optionNames.length < 2 || optionNames.length > 4) revert InvalidOptionCount();
        if (durationSeconds == 0) revert InvalidDuration();

        proposalId = proposalCount++;
        Proposal storage proposal = proposals[proposalId];
        proposal.name = name;
        proposal.deadline = block.timestamp + durationSeconds;
        proposal.exists = true;

        for (uint8 i = 0; i < optionNames.length; i++) {
            proposal.options.push(Option({name: optionNames[i], votes: zeroValue}));
            FHE.allowThis(proposal.options[i].votes);
        }

        emit ProposalCreated(proposalId, name, proposal.deadline);
    }

    function vote(uint256 proposalId, InEuint8 memory encryptedOptionIndex) external {
        Proposal storage proposal = _getProposal(proposalId);

        if (proposal.finalized) revert AlreadyFinalized();
        if (block.timestamp >= proposal.deadline) revert DeadlinePassed();
        if (proposal.hasVoted[msg.sender]) revert AlreadyVoted();

        euint8 optionIndex = FHE.asEuint8(encryptedOptionIndex);

        // Every option is updated on every vote so observers cannot infer the selected choice.
        for (uint8 i = 0; i < proposal.options.length; i++) {
            proposal.options[i].votes = FHE.add(
                proposal.options[i].votes,
                FHE.select(optionIndex.eq(FHE.asEuint8(i)), oneValue, zeroValue)
            );
            FHE.allowThis(proposal.options[i].votes);
        }

        proposal.hasVoted[msg.sender] = true;

        FHE.allowSender(optionIndex);
        emit VoteCast(proposalId, msg.sender, optionIndex);
    }

    function finalizeProposal(uint256 proposalId) external onlyOwner {
        Proposal storage proposal = _getProposal(proposalId);

        if (proposal.finalized) revert AlreadyFinalized();
        if (block.timestamp < proposal.deadline) revert DeadlineNotReached();

        proposal.finalized = true;

        for (uint8 i = 0; i < proposal.options.length; i++) {
            FHE.allowGlobal(proposal.options[i].votes);
        }

        emit ProposalFinalized(proposalId);
    }

    function getProposal(
        uint256 proposalId
    )
        external
        view
        returns (string memory name, uint256 deadline, bool finalized, string[] memory optionNames)
    {
        Proposal storage proposal = _getProposal(proposalId);

        name = proposal.name;
        deadline = proposal.deadline;
        finalized = proposal.finalized;
        optionNames = new string[](proposal.options.length);

        for (uint256 i = 0; i < proposal.options.length; i++) {
            optionNames[i] = proposal.options[i].name;
        }
    }

    function getOptionCount(uint256 proposalId) external view returns (uint256) {
        return _getProposal(proposalId).options.length;
    }

    function getEncryptedVoteHandle(uint256 proposalId, uint8 optionIndex) external view returns (euint64) {
        Proposal storage proposal = _getProposal(proposalId);
        if (optionIndex >= proposal.options.length) revert InvalidOptionIndex();

        return proposal.options[optionIndex].votes;
    }

    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return _getProposal(proposalId).hasVoted[voter];
    }

    function _getProposal(uint256 proposalId) internal view returns (Proposal storage proposal) {
        proposal = proposals[proposalId];
        if (!proposal.exists) revert ProposalNotFound();
    }
}
