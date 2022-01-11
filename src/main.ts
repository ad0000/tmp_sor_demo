import bunyan from 'bunyan';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

import { TOKENS } from './base_token';
import { Token, TokenAmount } from './entities';
import logging from './logging';
import { AlphaRouter, IRouter } from './router';
import {
  ISubgraphPoolProvider,
  SubgraphPoolProvider,
} from './subgraph_provider';
import { ChainId, ProviderConfig, SwapRoute, TradeType } from './types';

dotenv.config();

// ether global logger
ethers.utils.Logger.globalLogger();
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.DEBUG);

// custom global logger
const logger = bunyan.createLogger({
  name: 'Smart Order Router',
  serializers: bunyan.stdSerializers,
  level: bunyan.DEBUG,
});
logging.setGlobalLogger(logger);

type TradeParams = {
  amount: TokenAmount;
  quoteToken: Token;
  tradeType: TradeType;
};
const nodeUrl =
  'https://eth-mainnet.alchemyapi.io/v2/mgHwlYpgAvGEiR_RCgPiTfvT-yyJ6T03';

class TestSuite {
  private readonly provider: ethers.providers.BaseProvider;
  private readonly router: IRouter;
  private readonly subgraphPoolProvider: ISubgraphPoolProvider;
  constructor(public readonly chainId: ChainId) {
    // this.provider = ethers.providers.getDefaultProvider('mainnet');
    this.provider = new ethers.providers.JsonRpcProvider(nodeUrl);
    this.router = new AlphaRouter({
      provider: this.provider,
      chainId: this.chainId,
    });
    this.subgraphPoolProvider = new SubgraphPoolProvider(this.chainId);
  }

  public async quote({
    amount,
    quoteToken,
    tradeType,
  }: TradeParams): Promise<SwapRoute | undefined> {
    const swapRoute = await this.router.route(amount, quoteToken, tradeType, {
      // tx calldata is too large to send
      maxSwapsPerPath: 2,
    });
    return swapRoute;
  }

  public async getPools() {
    const curBlockNumber = await this.provider.getBlockNumber();
    const delay = 10;
    const blockNumber = curBlockNumber - delay;
    const providerConfig: ProviderConfig = { blockNumber };

    const now = Date.now();
    const rawPools = await this.subgraphPoolProvider.getPools(
      undefined,
      undefined,
      providerConfig
    );

    const deltaTime = Date.now() - now;
    logging.getGlobalLogger().info(deltaTime);
    logging.getGlobalLogger().info(rawPools.length);
  }
}

async function main() {
  const chainId = ChainId.MAINNET;
  const testSuite = new TestSuite(chainId);

  // trade params
  const tokens = TOKENS[chainId]!;
  const baseToken = tokens.WETH;
  const quoteToken = tokens.USDC;
  // find the best route for quote
  const tradeType = TradeType.EXACT_INPUT;
  const amount = new TokenAmount(
    baseToken,
    ethers.utils.parseUnits('1000', baseToken.decimals)
  );

  const swapRoute = await testSuite.quote({ amount, quoteToken, tradeType });
  if (!swapRoute) {
    return;
  }
}

main().catch(console.error);
