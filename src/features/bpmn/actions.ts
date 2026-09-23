"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isRedirectError, toUserMessage } from "@/lib/errors";
import { saveElementMetadataRecord, saveProcessXml } from "@/services/process-data";
import type { ElementMetadata } from "@/types/domain";

export interface SaveResult {
  ok: boolean;
  message?: string;
}

export async function saveDiagramAction(processId: string, xml: string): Promise<SaveResult> {
  try {
    const user = await requireUser();
    await saveProcessXml(user, processId, xml);
    revalidatePath("/processos");
    revalidatePath("/dashboard");
    revalidatePath(`/processos/${processId}`);
    return { ok: true };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return { ok: false, message: toUserMessage(error, "Erro ao salvar") };
  }
}

export async function saveMetadataAction(processId: string, metadata: ElementMetadata): Promise<SaveResult> {
  try {
    const user = await requireUser();
    await saveElementMetadataRecord(user, processId, metadata);
    revalidatePath(`/processos/${processId}`);
    return { ok: true };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return { ok: false, message: toUserMessage(error, "Erro ao salvar a documentação") };
  }
}
