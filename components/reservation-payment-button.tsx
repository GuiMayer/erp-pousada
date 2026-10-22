"use client";
import { formatNumber as localizedNumber } from "@/lib/utils/formatters"
import { PermissionGate } from "@/components/permission-gate";
import { reservationAmounts } from "@/lib/reservation-amounts";
import { formatCurrency } from "@/lib/utils/formatters";
import { useState } from "react";
import type { Reservation } from "@/lib/store";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { PaymentDialog } from "./payment-fields";

export function ReservationPaymentButton({
  reservation: latest,
}: {
  reservation: Reservation;
}) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Reservation | null>(null);
  const reservation = open && snapshot ? snapshot : latest;
  const { balance } = reservationAmounts([reservation]);
  if (!["confirmada", "checkin"].includes(reservation.status) || balance <= 0)
    return null;
  return (
    <>
      <PermissionGate permission="hospitality.receive">
        <Button
          variant="outline"
          size="sm"
          aria-label={`Receber ${formatCurrency(balance)} de ${reservation.guestName}`}
          title={`Saldo da hospedagem: ${formatCurrency(balance)}`}
          onClick={() => {
            setSnapshot(latest);
            setOpen(true);
          }}
        >
          Receber
        </Button>
      </PermissionGate>
      <ReservationPaymentDialog
        reservation={reservation}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
export function ReservationPaymentDialog({
  reservation,
  open,
  onClose,
}: {
  reservation: Reservation;
  open: boolean;
  onClose: () => void;
}) {
  const { runOperation, guests } = useApp();
  const balance = Math.max(
    0,
    reservation.totalValue - (reservation.paidValue ?? 0),
  );
  const credit =
    guests.find((guest) => guest.cpf === reservation.cpf)?.creditValue ?? 0;
  return (
    <PaymentDialog
      mixedEnabled
      open={open}
      onClose={onClose}
      title={`Hospedagem — ${reservation.guestName}${credit ? ` · crédito R$ ${localizedNumber(credit, 2)}` : ""}`}
      maximum={balance}
      allowCredit={credit > 0}
      onConfirm={async (paymentMethod, accountId, value, payments) => {
        await runOperation("pay-reservation", {
          reservationId: reservation.id,
          recordVersion: reservation.recordVersion,
          value, paymentMethod, accountId, payments,
        });
      }}
    />
  );
}
