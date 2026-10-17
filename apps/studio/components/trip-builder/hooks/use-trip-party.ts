"use client";

import {
  searchClients,
  removeTripBuilderTraveller,
  saveTripBuilderTraveller,
  updateTripBuilderTrip,
  type ClientSearchHit,
} from "@/lib/api";
import { showApiError, showSuccessToast } from "@/lib/feedback";

import { partySentence, whoElseText } from "../trip-builder-copy";
import type { PartyChoice } from "../trip-builder-helpers";
import { partyFromTravellers } from "../stages";

import type { TripChat } from "./use-trip-chat";
import type { TripCore } from "./use-trip-core";

/** Who is travelling: the client, the lead, each traveller, and adult or child. */
export function useTripParty(core: TripCore, chat: TripChat) {
  const {
    detail,
    setDetail,
    canWrite,
    setBusy,
    setRateOptions,
    setClientHits,
    setLeadHits,
    setRoleHits,
    activeLegIdRef,
    setOffer,
    closeOffer,
    hydrateStayDraft,
    refreshTrips,
    clearStayPrompts,
  } = core;
  const {
    appendTurn,
  } = chat;

  async function assignClient(client: ClientSearchHit) {
    if (!canWrite || !detail) return;
    setBusy(true);
    try {
      const response = await updateTripBuilderTrip(detail.trip.id, {
        primary_client_id: client.id,
      });
      setDetail(response.data);
      setClientHits([]);
      setOffer(null);
      await refreshTrips();
      showSuccessToast("Client saved.");
      const lead = response.data.client?.display_name?.trim() || "Client";
      void appendTurn(`Add ${lead}`, whoElseText(response.data));
    } catch (error) {
      showApiError(error);
      setOffer({ type: "assign", client });
    } finally {
      setBusy(false);
    }
  }

  async function addTraveller(
    person: { id: string; display_name: string; party_role: "adult" | "child" },
    userLine: string,
  ) {
    if (!canWrite || !detail) return;
    setBusy(true);
    setClientHits([]);
    setOffer(null);
    try {
      const response = await saveTripBuilderTraveller(detail.trip.id, {
        client_id: person.id,
        party_role: person.party_role,
      });
      setDetail(response.data);
      hydrateStayDraft(response.data, activeLegIdRef.current);
      await refreshTrips();
      const kind = person.party_role === "child" ? "child" : "adult";
      const followUp = response.data.trip.travellers_confirmed_at
        ? "Stay counts follow this list."
        : "Add someone else, or say **just them** when the list is complete.";
      appendTurn(
        userLine,
        `Added **${person.display_name}** as a ${kind}. ${partySentence(response.data)}\n\n${followUp}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function confirmTravellers(userLine: string) {
    if (!canWrite || !detail) return;
    setBusy(true);
    closeOffer("traveller");
    try {
      const response = await saveTripBuilderTraveller(detail.trip.id, { confirm: true });
      setDetail(response.data);
      hydrateStayDraft(response.data, activeLegIdRef.current);
      await refreshTrips();
      appendTurn(
        userLine,
        `Travellers are set: ${partySentence(response.data)}\n\nYou can ask what a country or city is like, or ask me to search hotels there. I only use what is on file.\n\nWhen you are ready, set the trip start and end. Every stay has to sit inside those days.\n\nStart: 2026-10-10\nEnd: 2026-10-20`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function changeLead(person: ClientSearchHit, userLine: string) {
    if (!canWrite || !detail) return;
    const before = partyFromTravellers(detail);
    const previous = detail.client?.display_name?.trim() || "The previous lead";
    setBusy(true);
    setLeadHits([]);
    setOffer(null);
    try {
      const response = await saveTripBuilderTraveller(detail.trip.id, {
        lead_client_id: person.id,
      });
      setDetail(response.data);
      hydrateStayDraft(response.data, activeLegIdRef.current);
      await refreshTrips();
      const after = partyFromTravellers(response.data);
      const countsChanged = before.adults !== after.adults || before.children !== after.children;
      if (countsChanged) {
        setRateOptions([]);
      }
      const followUp = response.data.trip.travellers_confirmed_at
        ? countsChanged
          ? "Stay counts follow this list. The selected rate was cleared, so search rates again."
          : "Stay counts follow this list."
        : "Add someone else, or say **just them** when the list is complete.";
      appendTurn(
        userLine,
        `**${person.display_name}** is now the lead. **${previous}** stays on the trip. ${partySentence(response.data)}\n\n${followUp}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function offerLead(name: string, userLine: string) {
    if (!detail) return;
    setBusy(true);
    closeOffer("traveller", "assign", "role", "rate-search");
    setRoleHits([]);
    clearStayPrompts();
    try {
      const response = await searchClients({ q: name, limit: 8 });
      const currentId = detail.client?.id ?? null;
      const hits = response.data.clients.filter((client) => client.id !== currentId);
      if (hits.length === 0) {
        setLeadHits([]);
        setOffer(null);
        appendTurn(
          userLine,
          response.data.clients.length > 0
            ? `**${detail.client?.display_name ?? name}** is already the lead.`
            : `**${name}** is not a client yet. Add them in Clients → New client, then ask to make them the lead.`,
        );
        return;
      }
      if (hits.length === 1) {
        const hit = hits[0]!;
        setLeadHits([]);
        setOffer({ type: "lead", person: hit });
        appendTurn(
          userLine,
          `Make **${hit.display_name}** the lead? **${detail.client?.display_name ?? "The current lead"}** stays on the trip. Say **yes** or tap **Make ${hit.display_name} the lead**.`,
        );
        return;
      }
      setLeadHits(hits);
      setOffer(null);
      appendTurn(
        userLine,
        `Several clients match **${name}**. Tap **Make … the lead** for the right person. The current lead stays on the trip.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function removeTraveller(clientId: string, name: string, userLine: string) {
    if (!canWrite || !detail) return;
    setBusy(true);
    try {
      const response = await removeTripBuilderTraveller(detail.trip.id, clientId);
      setDetail(response.data);
      hydrateStayDraft(response.data, activeLegIdRef.current);
      await refreshTrips();
      appendTurn(userLine, `Removed **${name}**. ${partySentence(response.data)}`);
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function offerTraveller(name: string, child: boolean, userLine: string) {
    if (!detail) return;
    setBusy(true);
    try {
      const response = await searchClients({ q: name, limit: 8 });
      const onTrip = new Set(detail.travellers.map((person) => person.client_id));
      const hits = response.data.clients.filter((client) => !onTrip.has(client.id));
      closeOffer("traveller", "lead", "role");
      setLeadHits([]);
      setRoleHits([]);
      if (hits.length === 0) {
        setClientHits([]);
        setOffer(null);
        appendTurn(
          userLine,
          response.data.clients.length > 0
            ? `**${name}** is already on this trip.`
            : `**${name}** is not a client yet. Add them in Clients → New client, then come back and say their name.`,
        );
        return;
      }
      if (hits.length === 1) {
        const hit = hits[0]!;
        setClientHits([]);
        setOffer({
          type: "traveller",
          person: { id: hit.id, display_name: hit.display_name, party_role: child ? "child" : "adult" },
        });
        appendTurn(
          userLine,
          `Add **${hit.display_name}**${child ? " as a child" : ""}? Say **yes** or tap **Add ${hit.display_name}**.`,
        );
        return;
      }
      setClientHits(hits);
      setOffer(null);
      appendTurn(
        userLine,
        `Several clients match **${name}**. Tap the right **Add** chip.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  function travellersNamed(name: string) {
    if (!detail) return [];
    const needle = name.trim().toLowerCase();
    const exact = detail.travellers.filter(
      (person) => person.display_name.trim().toLowerCase() === needle,
    );
    if (exact.length > 0) return exact;
    return detail.travellers.filter((person) => {
      const display = person.display_name.trim().toLowerCase();
      return display.includes(needle) || needle.includes(display);
    });
  }

  async function setPartyRole(person: PartyChoice, userLine: string) {
    if (!canWrite || !detail) return;
    const before = partyFromTravellers(detail);
    setBusy(true);
    setRoleHits([]);
    setOffer(null);
    try {
      const response = await saveTripBuilderTraveller(detail.trip.id, {
        client_id: person.id,
        party_role: person.party_role,
      });
      setDetail(response.data);
      hydrateStayDraft(response.data, activeLegIdRef.current);
      await refreshTrips();
      const after = partyFromTravellers(response.data);
      const countsChanged = before.adults !== after.adults || before.children !== after.children;
      if (countsChanged) {
        setRateOptions([]);
      }
      const kind = person.party_role === "child" ? "a child" : "an adult";
      const followUp =
        response.data.trip.travellers_confirmed_at && countsChanged
          ? "Stay counts follow this list. The selected rate was cleared, so search rates again."
          : response.data.trip.travellers_confirmed_at
            ? "Stay counts follow this list."
            : "Add someone else, or say **just them** when the list is complete.";
      appendTurn(
        userLine,
        `**${person.display_name}** is now ${kind}. ${partySentence(response.data)}\n\n${followUp}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function offerRole(name: string, role: "adult" | "child", userLine: string) {
    if (!detail) return;
    closeOffer("lead", "traveller", "role");
    setLeadHits([]);
    setRoleHits([]);
    const kind = role === "child" ? "a child" : "an adult";
    if (name.toLowerCase() === "lead") {
      setOffer(null);
      void appendTurn(userLine, "The lead stays an adult.");
      return;
    }
    const matches = travellersNamed(name).filter((person) => person.role !== "primary");
    if (matches.length === 0) {
      const leadOnly = travellersNamed(name).some((person) => person.role === "primary");
      setOffer(null);
      void appendTurn(
        userLine,
        leadOnly ? "The lead stays an adult." : `**${name}** is not on this trip.`,
      );
      return;
    }
    const ready = matches.filter((person) => person.party_role !== role);
    if (ready.length === 0) {
      setOffer(null);
      void appendTurn(
        userLine,
        `**${matches[0]?.display_name ?? name}** is already ${kind}.`,
      );
      return;
    }
    if (ready.length === 1) {
      const person = ready[0]!;
      const choice = {
        id: person.client_id,
        display_name: person.display_name,
        party_role: role,
      };
      setOffer({ type: "role", person: choice });
      void appendTurn(
        userLine,
        `Make **${person.display_name}** ${kind}? Say **yes** or tap **Make ${person.display_name} ${kind}**.`,
      );
      return;
    }
    setOffer(null);
    setRoleHits(
      ready.map((person) => ({
        id: person.client_id,
        display_name: person.display_name,
        party_role: role,
      })),
    );
    void appendTurn(
      userLine,
      `Several travellers match **${name}**. Tap **Make … ${kind}** for the right person.`,
    );
  }

  async function searchClientsForMessage(query: string) {
    const q = query.trim();
    if (q.length < 2) {
      setClientHits([]);
      return;
    }
    try {
      const response = await searchClients({ q, limit: 8 });
      setClientHits(response.data.clients);
    } catch (error) {
      showApiError(error);
    }
  }

  function chooseClient(hit: ClientSearchHit) {
    setClientHits([]);
    setOffer({ type: "assign", client: hit });
  }

  return {
    assignClient,
    addTraveller,
    confirmTravellers,
    changeLead,
    offerLead,
    removeTraveller,
    offerTraveller,
    setPartyRole,
    offerRole,
    searchClientsForMessage,
    chooseClient,
  };
}

