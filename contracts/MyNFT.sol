// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MyNFT
 * @dev 一个基础的NFT合约，支持铸造、转移和销毁功能
 */
contract MyNFT is ERC721, ERC721URIStorage, ERC721Burnable, Ownable {
    // tokenId计数器
    uint256 private _tokenIds;
    
    // 构造函数
    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {
        _tokenIds = 0;
    }
    
    // 铸造单个NFT
    function mint(address recipient) public onlyOwner returns (uint256) {
        _tokenIds++;
        uint256 newTokenId = _tokenIds;
        _mint(recipient, newTokenId);
        return newTokenId;
    }
    
    // 铸造带URI的NFT
    function mintNFT(address to, string memory uri) external onlyOwner returns (uint256) {
        _tokenIds++;
        uint256 newTokenId = _tokenIds;
        _mint(to, newTokenId);
        _setTokenURI(newTokenId, uri);
        return newTokenId;
    }
    
    // 批量铸造NFT
    function batchMint(address recipient, uint256 quantity) public onlyOwner {
        require(quantity > 0, "Quantity must be greater than 0");
        
        for (uint256 i = 0; i < quantity; i++) {
            _tokenIds++;
            _mint(recipient, _tokenIds);
        }
    }
    
    // 批量铸造带URI的NFT
    function batchMintWithURI(
        address[] memory to,
        string[] memory uris
    ) external onlyOwner {
        require(to.length == uris.length, "Arrays length mismatch");
        require(to.length > 0, "Arrays cannot be empty");
        
        for (uint256 i = 0; i < to.length; i++) {
            _tokenIds++;
            uint256 newTokenId = _tokenIds;
            _mint(to[i], newTokenId);
            _setTokenURI(newTokenId, uris[i]);
        }
    }
    
    // 设置现有NFT的URI
    function setTokenURI(uint256 tokenId, string memory newUri) external onlyOwner {
        // ownerOf会在token不存在时抛出异常
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        _setTokenURI(tokenId, newUri);
    }
    
    // 重写tokenURI函数
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    // 重写支持的接口
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(ERC721, ERC721URIStorage) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
    
    // 获取总供应量
    function totalSupply() external view returns (uint256) {
        return _tokenIds;
    }
    
    // 授权销毁代理
    mapping(address => bool) public burnApproved;
    
    // 设置销毁代理
    function setBurnApproval(address proxy, bool approved) external onlyOwner {
        burnApproved[proxy] = approved;
    }
    
    // 代理销毁函数
    function burnWithProxy(uint256 tokenId) external {
        require(burnApproved[msg.sender], "Not authorized to burn");
        _burn(tokenId);
    }
}