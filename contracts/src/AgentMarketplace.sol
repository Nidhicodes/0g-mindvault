// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title MindVault Agent Marketplace — trade trained AI agent INFTs
/// @notice List, delist, and buy agent INFTs. Seller sets price in native token.
contract AgentMarketplace {
    IERC721 public immutable inft;

    struct Listing {
        address seller;
        uint256 price; // in wei
    }

    mapping(uint256 => Listing) public listings;
    uint256[] public listedTokenIds;

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event Delisted(uint256 indexed tokenId, address indexed seller);
    event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);

    constructor(address _inft) {
        inft = IERC721(_inft);
    }

    /// @notice List an agent for sale. Caller must own the token and have approved this contract.
    function list(uint256 tokenId, uint256 price) external {
        require(inft.ownerOf(tokenId) == msg.sender, "Not owner");
        require(price > 0, "Price must be > 0");
        require(inft.getApproved(tokenId) == address(this) || inft.isApprovedForAll(msg.sender, address(this)), "Not approved");

        if (listings[tokenId].seller == address(0)) {
            listedTokenIds.push(tokenId);
        }
        listings[tokenId] = Listing(msg.sender, price);
        emit Listed(tokenId, msg.sender, price);
    }

    /// @notice Remove a listing
    function delist(uint256 tokenId) external {
        require(listings[tokenId].seller == msg.sender, "Not seller");
        delete listings[tokenId];
        emit Delisted(tokenId, msg.sender);
    }

    /// @notice Buy a listed agent. Sends payment to seller, transfers INFT to buyer.
    function buy(uint256 tokenId) external payable {
        Listing memory l = listings[tokenId];
        require(l.seller != address(0), "Not listed");
        require(msg.value >= l.price, "Insufficient payment");

        delete listings[tokenId];
        inft.safeTransferFrom(l.seller, msg.sender, tokenId);

        // Pay seller
        (bool ok, ) = payable(l.seller).call{value: l.price}("");
        require(ok, "Payment failed");

        // Refund excess
        if (msg.value > l.price) {
            (bool refundOk, ) = payable(msg.sender).call{value: msg.value - l.price}("");
            require(refundOk, "Refund failed");
        }

        emit Sold(tokenId, l.seller, msg.sender, l.price);
    }

    /// @notice Get number of listed tokens (includes delisted — check listing.seller != 0)
    function listedCount() external view returns (uint256) {
        return listedTokenIds.length;
    }

    /// @notice Get listing details
    function getListing(uint256 tokenId) external view returns (address seller, uint256 price) {
        Listing memory l = listings[tokenId];
        return (l.seller, l.price);
    }
}
