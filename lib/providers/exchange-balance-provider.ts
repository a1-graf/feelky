export interface ExchangeBalance {
  accountName: string;
  asset: "USDT" | "UAH" | "USD";
  balance: string;
  fetchedAt: Date;
}

export interface ExchangeBalanceProvider {
  readonly name: string;
  fetchBalances(): Promise<ExchangeBalance[]>;
}

export class MockExchangeBalanceProvider implements ExchangeBalanceProvider {
  readonly name: string = "Mock";

  async fetchBalances(): Promise<ExchangeBalance[]> {
    return [
      {
        accountName: "Мейн гаманець",
        asset: "USDT",
        balance: "0",
        fetchedAt: new Date()
      }
    ];
  }
}

export class MainWalletProvider extends MockExchangeBalanceProvider {
  readonly name = "Мейн гаманець";
}

export class BingXProvider extends MockExchangeBalanceProvider {
  readonly name = "BingX";
}

export class MexcProvider extends MockExchangeBalanceProvider {
  readonly name = "MEXC";
}
