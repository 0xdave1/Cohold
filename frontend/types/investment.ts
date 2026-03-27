/** Subset of POST /investments/fractional success payload */
export interface CreateFractionalResponse {
  investmentId: string;
  propertyId: string;
  amount?: string;
  totalCharge?: string;
  shares?: string;
  sharePrice?: string;
  [key: string]: unknown;
}
