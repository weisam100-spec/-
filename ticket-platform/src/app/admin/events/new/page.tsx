import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { NewEventForm } from "./NewEventForm";

export default async function NewEventPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/events/new");
  if (user.role !== "ADMIN") redirect("/");

  return <NewEventForm />;
}
