import { requestJson } from "../client";
import { getConfig, type SabreConfig } from "../config";
import {
  buildRateInfoRef,
  type SearchHotelRatesStay,
} from "../helpers";

export type SearchHotelRatesByCodeInput = SearchHotelRatesStay & {
  hotelCodes: string[];
  codeContext?: string;
  config?: SabreConfig;
};

/**
 * Shop live hotel rates for known Sabre hotel code(s).
 * Sabre: POST /v5/get/hotelavail with HotelRefs (preferred / open code path).
 * Never invents hotel codes.
 */
export async function searchHotelRatesByCode(
  input: SearchHotelRatesByCodeInput,
): Promise<unknown> {
  const config = input.config ?? getConfig();
  if (!config) {
    throw new Error("Sabre is not configured");
  }

  const codes = input.hotelCodes.map((c) => c.trim()).filter(Boolean);
  if (codes.length === 0) {
    throw new Error("At least one Sabre hotel code is required");
  }

  const codeContext = input.codeContext?.trim() || config.codeContext;
  const pageSize = Math.min(
    Math.max(input.pageSize ?? codes.length, 1),
    10,
  );

  const body = {
    GetHotelAvailRQ: {
      version: "5.0.0",
      POS: { Source: { PseudoCityCode: config.pcc } },
      SearchCriteria: {
        OffSet: 1,
        SortBy: "AverageNightlyRate",
        SortOrder: "ASC",
        PageSize: pageSize,
        HotelRefs: {
          HotelRef: codes.map((HotelCode) => ({
            HotelCode,
            CodeContext: codeContext,
          })),
        },
        RateInfoRef: buildRateInfoRef(input, { includeBestOnly: true }),
      },
    },
  };

  return requestJson({
    path: "/v5/get/hotelavail",
    body,
    config,
  });
}
