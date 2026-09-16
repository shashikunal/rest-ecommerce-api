import { sumLineTotals } from '../../domain/entities/Checkout';
import type {
  CheckoutPricingPort,
  PricedTotals,
  PriceLineInput,
} from '../../domain/ports/CheckoutPorts';

export class DefaultCheckoutPricing implements CheckoutPricingPort {
  async price(lines: PriceLineInput[], currency: string): Promise<PricedTotals> {
    const subtotalMinor = sumLineTotals(lines);
    return {
      subtotalMinor,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      grandTotalMinor: subtotalMinor,
      currency,
    };
  }
}
