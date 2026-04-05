// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title IERC7857 — Intelligent NFT interface (clone + metadata)
/// @dev Minimal interface for ERC-7857 compatibility
interface IERC7857 {
    function cloneAgent(uint256 originalId) external returns (uint256);
    function getAgent(uint256 tokenId) external view returns (
        string memory name,
        string memory storageRoot,
        string memory kvStreamId,
        string memory encryptedConfig,
        uint256 createdAt,
        uint256 updatedAt
    );
    event AgentCloned(uint256 indexed originalId, uint256 indexed cloneId, address indexed newOwner);
}

/// @title MindVault Agent INFT — ERC-7857 Intelligent NFT
/// @notice Each token represents an AI agent with encrypted persistent memory on 0G Storage
/// @dev Implements IERC7857 for clone semantics + ERC721 for ownership/transfer
contract MindVaultINFT is ERC721, Ownable, IERC7857 {
    uint256 private _nextTokenId;

    struct AgentMetadata {
        string name;
        string storageRoot;      // 0G Storage merkle root for agent memory
        string kvStreamId;       // 0G KV stream ID for live memory
        string encryptedConfig;  // Encrypted agent personality/system prompt
        uint256 createdAt;
        uint256 updatedAt;
    }

    mapping(uint256 => AgentMetadata) public agents;

    event AgentMinted(uint256 indexed tokenId, address indexed owner, string name);
    event MemoryUpdated(uint256 indexed tokenId, string storageRoot, string kvStreamId);

    constructor() ERC721("MindVault Agent", "MVAGENT") Ownable(msg.sender) {}

    /// @notice Mint a new agent INFT
    function mintAgent(
        string calldata name,
        string calldata encryptedConfig
    ) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        agents[tokenId] = AgentMetadata({
            name: name,
            storageRoot: "",
            kvStreamId: "",
            encryptedConfig: encryptedConfig,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        emit AgentMinted(tokenId, msg.sender, name);
        return tokenId;
    }

    /// @notice Update agent's 0G Storage references (only token owner)
    function updateMemory(
        uint256 tokenId,
        string calldata storageRoot,
        string calldata kvStreamId
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Not agent owner");
        agents[tokenId].storageRoot = storageRoot;
        agents[tokenId].kvStreamId = kvStreamId;
        agents[tokenId].updatedAt = block.timestamp;
        emit MemoryUpdated(tokenId, storageRoot, kvStreamId);
    }

    /// @notice Clone an agent — creates new INFT with same config (ERC-7857 clone)
    function cloneAgent(uint256 originalId) external returns (uint256) {
        require(ownerOf(originalId) == msg.sender, "Not agent owner");
        AgentMetadata memory original = agents[originalId];
        uint256 cloneId = _nextTokenId++;
        _safeMint(msg.sender, cloneId);
        agents[cloneId] = AgentMetadata({
            name: string.concat(original.name, " (Clone)"),
            storageRoot: "",
            kvStreamId: "",
            encryptedConfig: original.encryptedConfig,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        emit AgentCloned(originalId, cloneId, msg.sender);
        return cloneId;
    }

    /// @notice Get full agent metadata (IERC7857)
    function getAgent(uint256 tokenId) external view returns (
        string memory name,
        string memory storageRoot,
        string memory kvStreamId,
        string memory encryptedConfig,
        uint256 createdAt,
        uint256 updatedAt
    ) {
        require(tokenId < _nextTokenId, "Agent does not exist");
        AgentMetadata memory a = agents[tokenId];
        return (a.name, a.storageRoot, a.kvStreamId, a.encryptedConfig, a.createdAt, a.updatedAt);
    }

    /// @notice Total agents minted
    function totalAgents() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @notice ERC-165 interface detection
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IERC7857).interfaceId || super.supportsInterface(interfaceId);
    }
}
