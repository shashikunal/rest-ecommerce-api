import type {
  AddressInput,
  CheckoutAddressPort,
  ResolvedAddress,
} from '../../domain/ports/CheckoutPorts';

export class InlineCheckoutAddressResolver implements CheckoutAddressPort {
  async resolveShipping(input: AddressInput): Promise<ResolvedAddress> {
    return {
      fullName: input.fullName,
      phone: input.phone ?? null,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      region: input.region,
      postalCode: input.postalCode,
      country: input.country,
    };
  }

  async resolveBilling(
    input: AddressInput | null,
    shipping: AddressInput,
  ): Promise<ResolvedAddress> {
    if (!input) return this.resolveShipping(shipping);
    return this.resolveShipping(input);
  }
}
