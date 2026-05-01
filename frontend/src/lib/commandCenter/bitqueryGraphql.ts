/**
 * Bitquery Streaming GraphQL subscriptions (Solana).
 * Validate queries in the Bitquery IDE. Field names may differ by API version.
 */
export const TRANSFER_SUB = `subscription {
  Solana {
    Transfers(
      where: {
        Transfer: { AmountInUSD: { ge: "100000" }, Currency: { Native: false } }
        Transaction: { Result: { Success: true } }
      }
    ) {
      Block {
        Time
      }
      Transfer {
        Amount
        AmountInUSD
        Currency {
          Symbol
          MintAddress
        }
        Sender
        Receiver
      }
      Transaction {
        Signature
      }
    }
  }
}`;

export const BUY_SUB = `subscription {
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: { Side: { Type: { is: buy }, AmountInUSD: { ge: "100000" } } }
        Transaction: { Result: { Success: true } }
      }
    ) {
      Block {
        Time
      }
      Trade {
        Currency {
          Symbol
          MintAddress
        }
        Amount
        PriceInUSD
        Side {
          AmountInUSD
          Type
        }
        Dex {
          ProtocolName
        }
      }
      Transaction {
        Signature
        Signer
      }
    }
  }
}`;

export const SELL_SUB = `subscription {
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: { Side: { Type: { is: sell }, AmountInUSD: { ge: "100000" } } }
        Transaction: { Result: { Success: true } }
      }
    ) {
      Block {
        Time
      }
      Trade {
        Currency {
          Symbol
          MintAddress
        }
        Amount
        PriceInUSD
        Side {
          AmountInUSD
          Type
        }
        Dex {
          ProtocolName
        }
      }
      Transaction {
        Signature
        Signer
      }
    }
  }
}`;
