import { NextResponse } from "next/server";
import { listProblemsPublic } from "../../lib/problems";

// Public list of ranked problems for the create-duel picker. Safe: no hidden
// test data is included.
export async function GET() {
  return NextResponse.json({ problems: listProblemsPublic() });
}
