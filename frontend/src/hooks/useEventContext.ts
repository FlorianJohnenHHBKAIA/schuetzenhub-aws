import { useSearchParams, useLocation } from "react-router-dom";

/**
 * Hook to manage event context for navigation.
 * Stores the source event when navigating to related pages,
 * allowing "back to event" navigation.
 */
export const useEventContext = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  
  const eventId = searchParams.get("from_event");
  const eventTitle = searchParams.get("event_title");
  
  const hasEventContext = !!eventId;
  
  const getBackToEventUrl = () => {
    if (!eventId) return null;
    return `/portal/events/${eventId}/organize`;
  };
  
  const createLinkWithEventContext = (
    basePath: string,
    eventId: string,
    eventTitle?: string
  ) => {
    const params = new URLSearchParams();
    params.set("from_event", eventId);
    if (eventTitle) {
      params.set("event_title", eventTitle);
    }
    return `${basePath}?${params.toString()}`;
  };
  
  return {
    eventId,
    eventTitle,
    hasEventContext,
    getBackToEventUrl,
    createLinkWithEventContext,
  };
};

export default useEventContext;
