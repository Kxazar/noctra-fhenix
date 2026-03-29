// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {FHE, InEuint128, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {VeilStablecoin} from "./VeilStablecoin.sol";

contract ConfidentialStableController is Ownable {
    struct CollateralType {
        string name;
        address token;
        uint256 priceE4;
        bool enabled;
    }

    error AmountZero();
    error InvalidCollateralType();
    error NotEnabled();
    error ZeroAddress();
    error TooManyCollateralTypes();

    event CollateralTypeAdded(uint256 indexed collateralTypeId, string name, address token, uint256 priceE4);
    event CollateralPriceUpdated(uint256 indexed collateralTypeId, uint256 priceE4);
    event CollateralDeposited(address indexed account, uint256 indexed collateralTypeId, uint256 amount);
    event StableMinted(address indexed account, euint128 mintedAmount, uint256 maxDebt);

    uint256 public constant PRICE_PRECISION = 1e4;
    uint256 public constant MIN_COLLATERAL_RATIO_BPS = 16000;
    uint8 public constant MAX_COLLATERAL_TYPES = 4;

    VeilStablecoin public immutable stableToken;
    uint256 public collateralTypeCount;

    euint128 private zeroAmount;

    mapping(uint256 => CollateralType) private collateralTypes;
    mapping(address => mapping(uint256 => uint256)) public collateralBalances;
    mapping(address => euint128) private encryptedDebt;
    mapping(address => bool) private debtInitialized;

    constructor(address stableToken_) Ownable(msg.sender) {
        if (stableToken_ == address(0)) revert ZeroAddress();
        stableToken = VeilStablecoin(stableToken_);

        zeroAmount = FHE.asEuint128(0);
        FHE.allowThis(zeroAmount);
    }

    function addCollateralType(
        string calldata name,
        address token,
        uint256 priceE4
    ) external onlyOwner returns (uint256 collateralTypeId) {
        if (token == address(0)) revert ZeroAddress();
        if (collateralTypeCount >= MAX_COLLATERAL_TYPES) revert TooManyCollateralTypes();

        collateralTypeId = collateralTypeCount++;
        collateralTypes[collateralTypeId] = CollateralType({
            name: name,
            token: token,
            priceE4: priceE4,
            enabled: true
        });

        emit CollateralTypeAdded(collateralTypeId, name, token, priceE4);
    }

    function setCollateralPrice(uint256 collateralTypeId, uint256 priceE4) external onlyOwner {
        if (collateralTypeId >= collateralTypeCount) revert InvalidCollateralType();
        collateralTypes[collateralTypeId].priceE4 = priceE4;
        emit CollateralPriceUpdated(collateralTypeId, priceE4);
    }

    function depositCollateral(uint256 collateralTypeId, uint256 amount) external {
        if (amount == 0) revert AmountZero();
        if (collateralTypeId >= collateralTypeCount) revert InvalidCollateralType();

        CollateralType memory collateralType = collateralTypes[collateralTypeId];
        if (!collateralType.enabled) revert NotEnabled();

        IERC20(collateralType.token).transferFrom(msg.sender, address(this), amount);
        collateralBalances[msg.sender][collateralTypeId] += amount;

        emit CollateralDeposited(msg.sender, collateralTypeId, amount);
    }

    function mintStable(InEuint128 calldata desiredAmount) external {
        euint128 currentDebt = _getDebt(msg.sender);

        uint128 maxDebt = uint128((collateralValueOf(msg.sender) * 10_000) / MIN_COLLATERAL_RATIO_BPS);
        euint128 maxDebtEnc = FHE.asEuint128(maxDebt);
        euint128 requested = FHE.asEuint128(desiredAmount);

        FHE.allowThis(maxDebtEnc);
        FHE.allowThis(requested);

        euint128 availableHeadroom = FHE.select(currentDebt.lte(maxDebtEnc), FHE.sub(maxDebtEnc, currentDebt), zeroAmount);
        euint128 mintAmount = FHE.select(requested.lte(availableHeadroom), requested, availableHeadroom);

        encryptedDebt[msg.sender] = FHE.add(currentDebt, mintAmount);
        debtInitialized[msg.sender] = true;

        FHE.allowThis(encryptedDebt[msg.sender]);
        FHE.allow(encryptedDebt[msg.sender], msg.sender);
        FHE.allow(mintAmount, address(stableToken));

        stableToken.mintEncrypted(msg.sender, mintAmount);
        emit StableMinted(msg.sender, mintAmount, maxDebt);
    }

    function collateralValueOf(address account) public view returns (uint256 collateralValue) {
        for (uint256 collateralTypeId = 0; collateralTypeId < collateralTypeCount; collateralTypeId++) {
            CollateralType memory collateralType = collateralTypes[collateralTypeId];
            collateralValue += (collateralBalances[account][collateralTypeId] * collateralType.priceE4) / PRICE_PRECISION;
        }
    }

    function getCollateralType(uint256 collateralTypeId) external view returns (CollateralType memory) {
        if (collateralTypeId >= collateralTypeCount) revert InvalidCollateralType();
        return collateralTypes[collateralTypeId];
    }

    function getEncryptedDebt(address account) external view returns (euint128) {
        return _getDebt(account);
    }

    function _getDebt(address account) internal view returns (euint128) {
        if (!debtInitialized[account]) {
            return zeroAmount;
        }
        return encryptedDebt[account];
    }
}
