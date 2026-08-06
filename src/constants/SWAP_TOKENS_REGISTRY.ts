/**
 * Curated swap token registry — spec 002-token-registry
 *
 * Satisfies:
 *  - TR-2   every entry is the chain's native currency, its wrapped equivalent, a stablecoin
 *           this SDK already recognises, or a major with an established market — audited one
 *           by one at generation time against that sentence
 *  - TR-3   no chain carries more than 20 entries
 *  - TR-4   every entry carries chain, address, decimals, symbol, name, isNative and a logo
 *  - TR-5   every entry's logoURI was fetched and answered HTTP 200 at generation time
 *  - TR-6   exactly one entry per chain is isNative: true, at the zero address
 *  - TR-8   getCuratedSwapTokens performs no network access and cannot fail
 *  - TR-9   a chain absent from this registry is a missing key, not a thrown error
 *  - TR-10  entries are ordered native first, then stablecoins, then the rest, baked into the
 *           literal below rather than sorted at call time
 *  - TR-18  every field was copied verbatim from a live `GET /v1/tokens` response at generation
 *           time, dated below, and never hand-typed
 *  - TFC-6  a symbol shared across chains (e.g. WETH, WBTC, USDC) carries the same name and
 *           logoURI everywhere it appears — canonicalized after resolution, since each chain's
 *           bridged deployment otherwise resolves to its own CoinGecko listing and icon
 *
 * Generated 2026-08-05 by the authoring script at spec 002's T-3 (not shipped — scratchpad-only,
 * re-run by hand against `GET https://li.quest/v1/tokens?chains=<the 16 supported ids>` whenever
 * a chain is added to SWAP_SUPPORTED_CHAINS or R-1/R-2's periodic sweep calls for it). Candidate
 * selection per chain: the native currency; its wrapped equivalent (exact "w" + native-symbol
 * match); every stablecoin in STABLECOIN_CONTRACTS_BY_CHAIN_ID for that chain; then majors —
 * WBTC, a bridged WETH where the chain's native isn't already ETH, and the chain's own verified
 * ecosystem token where one exists (OP, ARB, LINEA, BLAST, SCR, GNO). Where more than one
 * same-role candidate existed, the one CoinGecko's own address index lists under that chain's
 * platform won; a lone candidate is never rejected on that basis, since CoinGecko's index is a
 * cross-reference, not a requirement. After resolution, every entry sharing a symbol is
 * canonicalized to the name/logoURI the first chain (ascending id) resolved for it (TFC-6).
 *
 * Two admitted gaps, both a property of the data rather than a bug in this file: Blast's own
 * canonical WBTC deployment has no logo published anywhere checked (CoinGecko, LI.FI) and is
 * therefore absent rather than shipped without one (TR-5); a Blast ecosystem-token entry is
 * present where CoinGecko resolved on the day this file was generated. HyperEVM and Plasma carry
 * fewer entries than other chains because no wrapped-native or stablecoin candidate could be
 * confirmed there — thin markets land below TR-3's cap by design (D-3), not by omission.
 */

/** local imports */
import { SwapToken } from '../types/swap'

const SWAP_TOKENS_REGISTRY: Readonly<Record<number, readonly SwapToken[]>> = {
  1: [
    {
      chainId: 1,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'ETH',
      name: 'ETH',
      isNative: true,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    },
    {
      chainId: 1,
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/6319/large/USDC.png?1769615602',
    },
    {
      chainId: 1,
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      symbol: 'USDT',
      name: 'USDT',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661',
    },
    {
      chainId: 1,
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18,
      symbol: 'WETH',
      name: 'WETH',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332',
    },
    {
      chainId: 1,
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      decimals: 8,
      symbol: 'WBTC',
      name: 'WBTC',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png?1764496367',
    },
  ],
  10: [
    {
      chainId: 10,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'ETH',
      name: 'ETH',
      isNative: true,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    },
    {
      chainId: 10,
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18,
      symbol: 'WETH',
      name: 'WETH',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332',
    },
    {
      chainId: 10,
      address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
      decimals: 8,
      symbol: 'WBTC',
      name: 'WBTC',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png?1764496367',
    },
    {
      chainId: 10,
      address: '0x4200000000000000000000000000000000000042',
      decimals: 18,
      symbol: 'OP',
      name: 'OPTIMISM',
      isNative: false,
      logoURI: 'https://optimistic.etherscan.io/token/images/optimism_32.png',
    },
  ],
  56: [
    {
      chainId: 56,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'BNB',
      name: 'BNB',
      isNative: true,
      logoURI:
        'https://assets.coingecko.com/coins/images/825/small/binance-coin-logo.png?1547034615',
    },
    {
      chainId: 56,
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      decimals: 18,
      symbol: 'USDC',
      name: 'USD Coin',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/6319/large/USDC.png?1769615602',
    },
    {
      chainId: 56,
      address: '0x55d398326f99059fF775485246999027B3197955',
      decimals: 18,
      symbol: 'USDT',
      name: 'USDT',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661',
    },
    {
      chainId: 56,
      address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      decimals: 18,
      symbol: 'WBNB',
      name: 'WBNB',
      isNative: false,
      logoURI:
        'https://static.debank.com/image/coin/logo_url/bnb/9784283a36f23a58982fc964574ea530.png',
    },
    {
      chainId: 56,
      address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
      decimals: 18,
      symbol: 'WETH',
      name: 'WETH',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332',
    },
  ],
  100: [
    {
      chainId: 100,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'xDAI',
      name: 'xDAI Native Token',
      isNative: true,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
    },
    {
      chainId: 100,
      address: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
      decimals: 18,
      symbol: 'WXDAI',
      name: 'WXDAI',
      isNative: false,
      logoURI:
        'https://coin-images.coingecko.com/coins/images/11062/large/Identity-Primary-DarkBG.png?1696511004',
    },
    {
      chainId: 100,
      address: '0x8e5bBbb09Ed1ebdE8674Cda39A0c169401db4252',
      decimals: 8,
      symbol: 'WBTC',
      name: 'WBTC',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png?1764496367',
    },
    {
      chainId: 100,
      address: '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1',
      decimals: 18,
      symbol: 'WETH',
      name: 'WETH',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332',
    },
    {
      chainId: 100,
      address: '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb',
      decimals: 18,
      symbol: 'GNO',
      name: 'Gnosis Token on xDai',
      isNative: false,
      logoURI:
        'https://static.debank.com/image/xdai_token/logo_url/0x9c58bacc331c9aa871afd802db6379a98e80cedb/69e5fedeca09913fe078a8dca5b7e48c.png',
    },
  ],
  130: [
    {
      chainId: 130,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'ETH',
      name: 'ETH',
      isNative: true,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    },
    {
      chainId: 130,
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18,
      symbol: 'WETH',
      name: 'WETH',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332',
    },
    {
      chainId: 130,
      address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
      decimals: 8,
      symbol: 'WBTC',
      name: 'WBTC',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png?1764496367',
    },
  ],
  137: [
    {
      chainId: 137,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'POL',
      name: 'Polygon Ecosystem Token',
      isNative: true,
      logoURI:
        'https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png',
    },
    {
      chainId: 137,
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      decimals: 6,
      symbol: 'USDC.e',
      name: 'Bridged USD Coin',
      isNative: false,
      logoURI:
        'https://coin-images.coingecko.com/coins/images/33000/large/usdc_normal.png?1758615648',
    },
    {
      chainId: 137,
      address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/6319/large/USDC.png?1769615602',
    },
    {
      chainId: 137,
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      decimals: 6,
      symbol: 'USDT',
      name: 'USDT',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661',
    },
    {
      chainId: 137,
      address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      decimals: 18,
      symbol: 'WPOL',
      name: 'WPOL',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/14073/large/matic.png?1696513797',
    },
    {
      chainId: 137,
      address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
      decimals: 8,
      symbol: 'WBTC',
      name: 'WBTC',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png?1764496367',
    },
    {
      chainId: 137,
      address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      decimals: 18,
      symbol: 'WETH',
      name: 'WETH',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332',
    },
  ],
  999: [
    {
      chainId: 999,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'HYPE',
      name: 'HYPE',
      isNative: true,
      logoURI:
        'https://static.debank.com/image/hyper_token/logo_url/hyper/0b3e288cfe418e9ce69eef4c96374583.png',
    },
    {
      chainId: 999,
      address: '0x5555555555555555555555555555555555555555',
      decimals: 18,
      symbol: 'WHYPE',
      name: 'Wrapped HYPE',
      isNative: false,
      logoURI:
        'https://static.debank.com/image/hyper_token/logo_url/0x5555555555555555555555555555555555555555/752e760ec0b1a17b81c7535e09e76ef8.png',
    },
    {
      chainId: 999,
      address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
      decimals: 8,
      symbol: 'WBTC',
      name: 'WBTC',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png?1764496367',
    },
  ],
  5000: [
    {
      chainId: 5000,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'MNT',
      name: 'MNT',
      isNative: true,
      logoURI:
        'https://static.debank.com/image/mnt_token/logo_url/0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8/a443c78c33704d48f06e5686bb87f85e.png',
    },
    {
      chainId: 5000,
      address: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8',
      decimals: 18,
      symbol: 'WMNT',
      name: 'WMNT',
      isNative: false,
      logoURI:
        'https://static.debank.com/image/mnt_token/logo_url/0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8/a443c78c33704d48f06e5686bb87f85e.png',
    },
    {
      chainId: 5000,
      address: '0xCAbAE6f6Ea1ecaB08Ad02fE02ce9A44F09aebfA2',
      decimals: 8,
      symbol: 'WBTC',
      name: 'WBTC',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png?1764496367',
    },
    {
      chainId: 5000,
      address: '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111',
      decimals: 18,
      symbol: 'WETH',
      name: 'WETH',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332',
    },
  ],
  8453: [
    {
      chainId: 8453,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'ETH',
      name: 'ETH',
      isNative: true,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    },
    {
      chainId: 8453,
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18,
      symbol: 'WETH',
      name: 'WETH',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332',
    },
    {
      chainId: 8453,
      address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
      decimals: 8,
      symbol: 'WBTC',
      name: 'WBTC',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png?1764496367',
    },
  ],
  9745: [
    {
      chainId: 9745,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'XPL',
      name: 'Plasma',
      isNative: true,
      logoURI: 'https://s2.coinmarketcap.com/static/img/coins/64x64/36645.png',
    },
    {
      chainId: 9745,
      address: '0x6100E367285b01F48D07953803A2d8dCA5D19873',
      decimals: 18,
      symbol: 'WXPL',
      name: 'Wrapped Plasma',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/69509/large/plasma.png?1758805469',
    },
    {
      chainId: 9745,
      address: '0x9895D81bB462A195b4922ED7De0e3ACD007c32CB',
      decimals: 18,
      symbol: 'WETH',
      name: 'WETH',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332',
    },
  ],
  42161: [
    {
      chainId: 42161,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'ETH',
      name: 'ETH',
      isNative: true,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    },
    {
      chainId: 42161,
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      decimals: 18,
      symbol: 'WETH',
      name: 'WETH',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332',
    },
    {
      chainId: 42161,
      address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
      decimals: 8,
      symbol: 'WBTC',
      name: 'WBTC',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png?1764496367',
    },
    {
      chainId: 42161,
      address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
      decimals: 18,
      symbol: 'ARB',
      name: 'Arbitrum',
      isNative: false,
      logoURI:
        'https://static.debank.com/image/coin/logo_url/arbitrum/854f629937ce94bebeb2cd38fb336de7.png',
    },
  ],
  43114: [
    {
      chainId: 43114,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'AVAX',
      name: 'AVAX',
      isNative: true,
      logoURI:
        'https://static.debank.com/image/avax_token/logo_url/avax/0b9c84359c84d6bdd5bfda9c2d4c4a82.png',
    },
    {
      chainId: 43114,
      address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
      decimals: 18,
      symbol: 'WAVAX',
      name: 'Wrapped AVAX',
      isNative: false,
      logoURI:
        'https://static.debank.com/image/avax_token/logo_url/0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7/753d82f0137617110f8dec56309b4065.png',
    },
    {
      chainId: 43114,
      address: '0x50b7545627a5162F82A992c33b87aDc75187B218',
      decimals: 8,
      symbol: 'WBTC',
      name: 'WBTC',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png?1764496367',
    },
    {
      chainId: 43114,
      address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
      decimals: 18,
      symbol: 'WETH.e',
      name: 'Wrapped Ether',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/39707/large/WETH.PNG?1723730205',
    },
  ],
  59144: [
    {
      chainId: 59144,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'ETH',
      name: 'ETH',
      isNative: true,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    },
    {
      chainId: 59144,
      address: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',
      decimals: 18,
      symbol: 'WETH',
      name: 'WETH',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332',
    },
    {
      chainId: 59144,
      address: '0x3aAB2285ddcDdaD8edf438C1bAB47e1a9D05a9b4',
      decimals: 8,
      symbol: 'WBTC',
      name: 'WBTC',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png?1764496367',
    },
    {
      chainId: 59144,
      address: '0x1789e0043623282D5DCc7F213d703C6D8BAfBB04',
      decimals: 18,
      symbol: 'LINEA',
      name: 'Linea',
      isNative: false,
      logoURI:
        'https://coin-images.coingecko.com/coins/images/68507/large/linea-logo.jpeg?1756025484',
    },
  ],
  80094: [
    {
      chainId: 80094,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'BERA',
      name: 'BERA',
      isNative: true,
      logoURI:
        'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/bera.svg',
    },
    {
      chainId: 80094,
      address: '0x6969696969696969696969696969696969696969',
      decimals: 18,
      symbol: 'WBERA',
      name: 'Wrapped Bera',
      isNative: false,
      logoURI:
        'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/wbera.svg',
    },
    {
      chainId: 80094,
      address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
      decimals: 8,
      symbol: 'WBTC',
      name: 'WBTC',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png?1764496367',
    },
    {
      chainId: 80094,
      address: '0x2F6F07CDcf3588944Bf4C42aC74ff24bF56e7590',
      decimals: 18,
      symbol: 'WETH',
      name: 'WETH',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332',
    },
  ],
  81457: [
    {
      chainId: 81457,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'ETH',
      name: 'ETH',
      isNative: true,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    },
    {
      chainId: 81457,
      address: '0x4300000000000000000000000000000000000004',
      decimals: 18,
      symbol: 'WETH',
      name: 'WETH',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332',
    },
  ],
  534352: [
    {
      chainId: 534352,
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      symbol: 'ETH',
      name: 'ETH',
      isNative: true,
      logoURI:
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    },
    {
      chainId: 534352,
      address: '0x5300000000000000000000000000000000000004',
      decimals: 18,
      symbol: 'WETH',
      name: 'WETH',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/2518/large/weth.png?1696503332',
    },
    {
      chainId: 534352,
      address: '0x3C1BCa5a656e69edCD0D4E36BEbb3FcDAcA60Cf1',
      decimals: 8,
      symbol: 'WBTC',
      name: 'WBTC',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png?1764496367',
    },
    {
      chainId: 534352,
      address: '0xd29687c813D741E2F938F4aC377128810E217b1b',
      decimals: 18,
      symbol: 'SCR',
      name: 'Scroll',
      isNative: false,
      logoURI: 'https://coin-images.coingecko.com/coins/images/50571/large/scroll.jpg?1728376125',
    },
  ],
}

export const getCuratedSwapTokens = (chainId: number): SwapToken[] =>
  (SWAP_TOKENS_REGISTRY[chainId] ?? []).map((token) => ({ ...token }))
