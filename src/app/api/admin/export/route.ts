import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import {
  buildExport,
  isExportDataset,
  isExportFormat,
  formatsFor,
} from "@/lib/admin-export";


/** UTF-8 BOM so Excel renders accented characters in CSV correctly. */
const BOM = "﻿";

/**
 * Admin-only data export. `GET /api/admin/export?dataset=players&format=csv`
 * streams the requested sheet/backup as a download. Anything but a valid
 * admin + dataset/format combo is refused.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Azione riservata all'amministratore" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const dataset = url.searchParams.get("dataset") ?? "";
  const format = url.searchParams.get("format") ?? "";

  if (!isExportDataset(dataset) || !isExportFormat(format)) {
    return NextResponse.json(
      { error: "Parametri di export non validi" },
      { status: 400 },
    );
  }
  if (!formatsFor(dataset).includes(format)) {
    return NextResponse.json(
      { error: `Formato ${format} non disponibile per ${dataset}` },
      { status: 400 },
    );
  }

  let file;
  try {
    file = await buildExport(dataset, format, new Date());
  } catch (err) {
    console.error("[admin-export] generazione fallita:", err);
    return NextResponse.json(
      { error: "Export non riuscito, riprova" },
      { status: 500 },
    );
  }

  const payload = format === "csv" ? BOM + file.body : file.body;
  return new NextResponse(payload, {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
