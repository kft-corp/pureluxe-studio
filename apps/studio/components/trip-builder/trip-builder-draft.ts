/** Prefill / focus hints from home starters or the notes composer. */
export type TripBuilderDraft = {
  focus: "client" | "hotel";
  clientQuery?: string;
  hotelName?: string;
};
