import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

const registerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email(),
  password: z.string().min(8)
});

export async function POST(request: Request) {
  const input = registerSchema.parse(await request.json());
  const email = input.email.toLowerCase().trim();
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return NextResponse.json({ error: "Registration is closed for this instance" }, { status: 403 });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Користувач із таким email уже існує" }, { status: 409 });
  }
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      passwordHash: await hashPassword(input.password)
    },
    select: { id: true, email: true, name: true }
  });
  return NextResponse.json(user, { status: 201 });
}
