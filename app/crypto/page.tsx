import { redirect } from "next/navigation";

/** The former “Мейн гаманець” dashboard is intentionally hidden; the account remains in the ledger. */
export default function CryptoPage() {
  redirect("/overview");
}
