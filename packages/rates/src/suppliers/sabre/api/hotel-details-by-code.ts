import { requestJson } from "../client";
import { getConfig, type SabreConfig } from "../config";
import {
  buildRateInfoRef,
  type SearchHotelRatesStay,
} from "../helpers";

export type SearchHotelDetailsByCodeInput = SearchHotelRatesStay & {
  hotelCode: string;
  codeContext?: string;
  config?: SabreConfig;
};

/**
 * Room options + RateKey + cancel/payment for one Sabre hotel code.
 * Sabre: POST /v5/get/hoteldetails (Stage 2 normalize path).
 * Never invents hotel codes.
 */
export async function searchHotelDetailsByCode(
  input: SearchHotelDetailsByCodeInput,
): Promise<unknown> {
  const config = input.config ?? getConfig();
  if (!config) {
    throw new Error("Sabre is not configured");
  }

  const hotelCode = input.hotelCode.trim();
  if (!hotelCode) {
    throw new Error("A Sabre hotel code is required");
  }

  const codeContext = input.codeContext?.trim() || config.codeContext;

  // Details does not use BestOnly — full room/rate set for the property.
  const rateInfoRef = buildRateInfoRef(input, { includeBestOnly: false });

  const body = {
    GetHotelDetailsRQ: {
      version: "5.0.0",
      POS: { Source: { PseudoCityCode: config.pcc } },
      SearchCriteria: {
        HotelRefs: {
          HotelRef: {
            HotelCode: hotelCode,
            CodeContext: codeContext,
          },
        },
        RateInfoRef: rateInfoRef,
        HotelContentRef: {
          DescriptiveInfoRef: {
            PropertyInfo: true,
            LocationInfo: true,
            Amenities: true,
          },
          MediaRef: {
            MaxItems: "5",
            MediaTypes: {
              Images: { Image: [{ Type: "LARGE" }] },
            },
          },
        },
      },
    },
  };

  return requestJson({
    path: "/v5/get/hoteldetails",
    body,
    config,
  });
}
