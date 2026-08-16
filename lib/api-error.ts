import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

/**
 * Maps thrown errors to safe HTTP responses.
 * - ZodError -> 422 with field issues
 * - "Unauthorized" -> 401
 * - Prisma internals -> generic 400 (never leaked to the client)
 * - other business Error -> 400 with its (intentional, user-facing) message
 * - unknown -> generic 500
 */
export function apiError(error: unknown, fallbackMessage = "Something went wrong") {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Некоректні дані", issues: error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return NextResponse.json({ error: fallbackMessage }, { status: 400 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
