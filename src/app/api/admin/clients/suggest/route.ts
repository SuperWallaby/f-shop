import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { requireAdmin } from "../../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../../_utils/http";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;
  try {
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    const { clients } = await getCollections();

    const docs =
      q.length < 1
        ? await clients.find({}).sort({ updatedAt: -1 }).limit(40).toArray()
        : await clients
            .find({
              $or: [
                {
                  name: new RegExp(
                    q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                    "i",
                  ),
                },
                {
                  email: new RegExp(
                    q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                    "i",
                  ),
                },
                {
                  whatsapp: new RegExp(
                    q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                    "i",
                  ),
                },
              ],
            })
            .sort({ updatedAt: -1 })
            .limit(25)
            .toArray();

    return jsonOk({
      clients: docs.map((c) => ({
        id: c._id!.toHexString(),
        name: c.name || "",
        email: c.email || "",
        whatsapp: c.whatsapp || "",
        studentStatus: c.studentStatus,
      })),
    });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
