/**
 * Bitquery GraphQL over WebSocket — use {@link createClient} from `graphql-ws` with {@link BITQUERY_WS_URL}.
 * Subscription strings live in `commandCenter/bitqueryGraphql.ts`.
 */
export { createClient } from "graphql-ws";
export { BITQUERY_WS_URL } from "./commandCenter/constants";
