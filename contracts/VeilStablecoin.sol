// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {FHE, InEuint128, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract VeilStablecoin is ERC20, Ownable {
    error StableInvalidSender();
    error StableInvalidReceiver();
    error NotAuthorizedMinter();

    using FHE for uint256;

    mapping(address => euint128) public encBalances;
    mapping(address => bool) public minters;

    euint128 public totalEncryptedSupply = FHE.asEuint128(0);
    euint128 private immutable ZERO = FHE.asEuint128(0);

    modifier onlyMinterOrOwner() {
        if (msg.sender != owner() && !minters[msg.sender]) revert NotAuthorizedMinter();
        _;
    }

    constructor() ERC20("Veil USD", "vhUSD") Ownable(msg.sender) {
        FHE.allowThis(ZERO);
    }

    function setMinter(address account, bool allowed) external onlyOwner {
        minters[account] = allowed;
    }

    function mint(address user, uint256 amount) public onlyMinterOrOwner {
        _mint(user, amount);
    }

    function burn(address user, uint256 amount) public onlyMinterOrOwner {
        _burn(user, amount);
    }

    function mintEncrypted(address user, InEuint128 memory amount) public onlyMinterOrOwner {
        _mintEnc(user, FHE.asEuint128(amount));
    }

    function mintEncrypted(address user, euint128 amount) public onlyMinterOrOwner {
        _mintEnc(user, amount);
    }

    function _mintEnc(address user, euint128 amount) internal {
        encBalances[user] = encBalances[user].add(amount);
        totalEncryptedSupply = totalEncryptedSupply.add(amount);

        FHE.allowThis(encBalances[user]);
        FHE.allow(encBalances[user], user);
        FHE.allowGlobal(totalEncryptedSupply);
    }

    function burnEncrypted(address user, InEuint128 memory amount) public onlyMinterOrOwner returns (euint128) {
        return _burnEnc(user, FHE.asEuint128(amount));
    }

    function burnEncrypted(address user, euint128 amount) public onlyMinterOrOwner returns (euint128) {
        return _burnEnc(user, amount);
    }

    function _burnEnc(address user, euint128 amount) internal returns (euint128 burnAmount) {
        burnAmount = _calculateBurnAmount(user, amount);
        encBalances[user] = encBalances[user].sub(burnAmount);
        totalEncryptedSupply = totalEncryptedSupply.sub(burnAmount);

        FHE.allowThis(encBalances[user]);
        FHE.allow(encBalances[user], user);
        FHE.allowGlobal(totalEncryptedSupply);
    }

    function _calculateBurnAmount(address user, euint128 amount) internal returns (euint128) {
        return FHE.select(amount.lte(encBalances[user]), amount, ZERO);
    }

    function transferEncrypted(address to, InEuint128 memory amount) external returns (euint128) {
        return _transferImpl(msg.sender, to, FHE.asEuint128(amount));
    }

    function transferEncrypted(address to, euint128 amount) external returns (euint128) {
        return _transferImpl(msg.sender, to, amount);
    }

    function transferFromEncrypted(address from, address to, InEuint128 memory amount) external returns (euint128) {
        return _transferImpl(from, to, FHE.asEuint128(amount));
    }

    function transferFromEncrypted(address from, address to, euint128 amount) external returns (euint128) {
        return _transferImpl(from, to, amount);
    }

    function _transferImpl(address from, address to, euint128 amount) internal returns (euint128) {
        if (from == address(0)) revert StableInvalidSender();
        if (to == address(0)) revert StableInvalidReceiver();

        euint128 amountToSend = FHE.select(amount.lte(encBalances[from]), amount, ZERO);

        encBalances[to] = encBalances[to].add(amountToSend);
        encBalances[from] = encBalances[from].sub(amountToSend);

        FHE.allowThis(encBalances[to]);
        FHE.allowThis(encBalances[from]);
        FHE.allow(encBalances[to], to);
        FHE.allow(encBalances[from], from);

        return amountToSend;
    }

    function decryptBalance(address user) public {
        FHE.decrypt(encBalances[user]);
    }

    function getDecryptBalanceResult(address user) public view returns (uint128) {
        return FHE.getDecryptResult(encBalances[user]);
    }

    function getDecryptBalanceResultSafe(address user) public view returns (uint128, bool) {
        return FHE.getDecryptResultSafe(encBalances[user]);
    }
}
