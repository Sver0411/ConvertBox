import { notFound } from "next/navigation";
import Workspace from "@/components/workspace";
import { toolFromPath } from "@/lib/tools/registry";

export default async function ToolRoute({ params }: { params: Promise<{ category: string; tool: string }> }) {
  const { category, tool: slug } = await params;
  const definition = toolFromPath(category, slug);
  if (!definition) notFound();
  if (definition.workspace) return <Workspace initialView={definition.workspace} initialOperation={definition.operation} initialToolId={definition.id} />;
  notFound();
}
