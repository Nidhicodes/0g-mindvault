// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title MindVault Memory Registry — on-chain index of agent memory snapshots
/// @notice Links agent IDs to their 0G Storage roots for verifiable memory persistence
contract MemoryRegistry {
    struct MemorySnapshot {
        string storageRoot;   // 0G Storage merkle root
        uint256 timestamp;
        uint256 memoryCount;  // number of memories in this snapshot
    }

    // agentTokenId => snapshots
    mapping(uint256 => MemorySnapshot[]) public snapshots;
    // agentTokenId => owner who can write
    mapping(uint256 => address) public writers;

    event SnapshotRecorded(uint256 indexed agentId, string storageRoot, uint256 memoryCount);
    event WriterSet(uint256 indexed agentId, address writer);

    function setWriter(uint256 agentId, address writer) external {
        require(writers[agentId] == address(0) || writers[agentId] == msg.sender, "Not authorized");
        writers[agentId] = writer;
        emit WriterSet(agentId, writer);
    }

    function recordSnapshot(
        uint256 agentId,
        string calldata storageRoot,
        uint256 memoryCount
    ) external {
        require(writers[agentId] == msg.sender, "Not authorized writer");
        snapshots[agentId].push(MemorySnapshot({
            storageRoot: storageRoot,
            timestamp: block.timestamp,
            memoryCount: memoryCount
        }));
        emit SnapshotRecorded(agentId, storageRoot, memoryCount);
    }

    function getSnapshotCount(uint256 agentId) external view returns (uint256) {
        return snapshots[agentId].length;
    }

    function getLatestSnapshot(uint256 agentId) external view returns (MemorySnapshot memory) {
        require(snapshots[agentId].length > 0, "No snapshots");
        return snapshots[agentId][snapshots[agentId].length - 1];
    }
}
