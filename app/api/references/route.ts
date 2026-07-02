import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUserId } from "@/lib/session";

const kindSchema = z.enum(["category", "incomeSource"]);

const createSchema = z.object({
  kind: kindSchema,
  name: z.string().trim().min(1)
});

const updateSchema = z.object({
  kind: kindSchema,
  id: z.string().min(1),
  name: z.string().trim().min(1),
  isActive: z.boolean()
});

export async function POST(request: Request) {
  try {
    const userId = await requireApiUserId();
    const input = createSchema.parse(await request.json());

    if (input.kind === "category") {
      const last = await prisma.category.findFirst({ where: { userId }, orderBy: { sortOrder: "desc" } });
      const item = await prisma.category.upsert({
        where: { userId_name: { userId, name: input.name } },
        update: { isActive: true },
        create: { userId, name: input.name, sortOrder: (last?.sortOrder ?? -1) + 1 }
      });
      return NextResponse.json(item, { status: 201 });
    }

    const item = await prisma.incomeSource.upsert({
      where: { userId_name: { userId, name: input.name } },
      update: { isActive: true },
      create: { userId, name: input.name }
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reference create error" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireApiUserId();
    const input = updateSchema.parse(await request.json());

    if (input.kind === "category") {
      const current = await prisma.category.findFirst({ where: { id: input.id, userId } });
      if (!current) return NextResponse.json({ error: "Category not found" }, { status: 404 });
      const item = await prisma.category.update({
        where: { id: input.id },
        data: { name: input.name, isActive: input.isActive }
      });
      return NextResponse.json(item);
    }

    const current = await prisma.incomeSource.findFirst({ where: { id: input.id, userId } });
    if (!current) return NextResponse.json({ error: "Income source not found" }, { status: 404 });
    const item = await prisma.incomeSource.update({
      where: { id: input.id },
      data: { name: input.name, isActive: input.isActive }
    });
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reference update error" }, { status: 400 });
  }
}
