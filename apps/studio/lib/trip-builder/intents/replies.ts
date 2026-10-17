const CONFIRM =
  /^(?:yes|yeah|yep|yup|confirm|ok|okay|do it|go ahead|add them|please do)[.!]*$/i;

const DECLINE = /^(?:no|nope|cancel|stop|don't|do not)[.!]*$/i;

/** The whole message is a short yes. "Okay, what is the visa?" is a question. */
export function isConfirmReply(message: string): boolean {
  return CONFIRM.test(message.trim());
}

/** The whole message is a short no. */
export function isDeclineReply(message: string): boolean {
  return DECLINE.test(message.trim());
}
