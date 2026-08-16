import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUserId } from "@/lib/session";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

const deleteSchema = z.object({
  kind: kindSchema,
  id: z.string().min(1)
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
    return apiError(error, "Reference create error");
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireApiUserId();
    const input = updateSchema.parse(await request.json());

    if (input.kind === "category") {
      const current = await prisma.category.findFirst({ where: { id: input.id, userId } });
      if (!current) return NextResponse.json({ error: "Category not found" }, { status: 404 });
      if (!current.isActive) return NextResponse.json({ error: "Категорію вже видалено" }, { status: 409 });
      const duplicate = await prisma.category.findFirst({ where: { userId, name: input.name, id: { not: input.id } } });
      if (duplicate) return NextResponse.json({ error: "Така категорія вже є" }, { status: 409 });
      const item = await prisma.category.update({
        where: { id: input.id },
        data: { name: input.name, isActive: input.isActive }
      });
      return NextResponse.json(item);
    }

    const current = await prisma.incomeSource.findFirst({ where: { id: input.id, userId } });
    if (!current) return NextResponse.json({ error: "Income source not found" }, { status: 404 });
    if (!current.isActive) return NextResponse.json({ error: "Джерело вже видалено" }, { status: 409 });
    const duplicate = await prisma.incomeSource.findFirst({ where: { userId, name: input.name, id: { not: input.id } } });
    if (duplicate) return NextResponse.json({ error: "Таке джерело вже є" }, { status: 409 });
    const item = await prisma.incomeSource.update({
      where: { id: input.id },
      data: { name: input.name, isActive: input.isActive }
    });
    return NextResponse.json(item);
  } catch (error) {
    return apiError(error, "Reference update error");
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireApiUserId();
    const input = deleteSchema.parse(await request.json());

    if (input.kind === "category") {
      const current = await prisma.category.findFirst({ where: { id: input.id, userId } });
      if (!current) return NextResponse.json({ error: "Category not found" }, { status: 404 });
      const item = await prisma.category.update({ where: { id: input.id }, data: { isActive: false } });
      const activeAfterDelete = await prisma.category.count({ where: { id: input.id, userId, isActive: true } });
      return NextResponse.json({ item, mode: "disabled", activeAfterDelete: activeAfterDelete > 0 });
    }

    const current = await prisma.incomeSource.findFirst({ where: { id: input.id, userId } });
    if (!current) return NextResponse.json({ error: "Income source not found" }, { status: 404 });
    const item = await prisma.incomeSource.update({ where: { id: input.id }, data: { isActive: false } });
    const activeAfterDelete = await prisma.incomeSource.count({ where: { id: input.id, userId, isActive: true } });
    return NextResponse.json({ item, mode: "disabled", activeAfterDelete: activeAfterDelete > 0 });
  } catch (error) {
    return apiError(error, "Reference delete error");
  }
}
