import { notFound } from "next/navigation";
import ToolPage from "@/components/tool-page";
import { toolFromPath } from "@/lib/tools/registry";

export default async function ToolRoute({ params }: { params: Promise<{ category: string; tool: string }> }) {
  const { category, tool: slug } = await params;
  const definition = toolFromPath(category, slug);
  if (!definition) notFound();
  return <ToolPage key={definition.id} tool={definition} />;
}
