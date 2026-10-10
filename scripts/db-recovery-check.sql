-- Business reconciliation after restore; failures require investigation.
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM stock_items s JOIN pos_products p ON p.id=s."productId" JOIN product_categories c ON c.id=p."categoryId" LEFT JOIN (SELECT "productId",sum(quantity) qty FROM stock_lots GROUP BY "productId") l ON l."productId"=s."productId" WHERE NOT c."isRestaurant" AND p."trackStock" AND s."currentStock"<>coalesce(l.qty,0)) THEN RAISE EXCEPTION 'Saldo de bebidas diverge dos lotes'; END IF;
 IF EXISTS (SELECT 1 FROM purchases p LEFT JOIN expenses e ON e."sourcePurchaseId"=p.id WHERE p.total>0 AND e.id IS NULL) THEN RAISE EXCEPTION 'Compra recebida sem obrigação financeira'; END IF;
 IF EXISTS (SELECT 1 FROM expenses e JOIN purchases p ON p.id=e."sourcePurchaseId" WHERE abs(p.total-e.value-coalesce((SELECT sum(r."agreedValue") FROM purchase_returns r JOIN stock_lots l ON l.id=r."lotId" JOIN purchase_items i ON i.id=l."purchaseItemId" WHERE i."purchaseId"=p.id AND r.resolution='discount' AND r.status='settled'),0))>0.005) THEN RAISE EXCEPTION 'Compra, dívida e abatimentos não reconciliados'; END IF;
 IF EXISTS (SELECT 1 FROM expenses WHERE "paidValue"<0 OR "paidValue">value) OR EXISTS (SELECT 1 FROM accounts_receivable WHERE "paidValue"<0 OR "paidValue">value) THEN RAISE EXCEPTION 'Liquidação de título inválida'; END IF;
 IF EXISTS (SELECT 1 FROM stock_lots WHERE quantity<0 OR "remainingValue"<0 OR (quantity=0 AND "remainingValue"<>0)) THEN RAISE EXCEPTION 'Quantidade/valor de lote inválido'; END IF;
 IF EXISTS (SELECT 1 FROM stays s LEFT JOIN reservations r ON r.id=s."reservationId" WHERE r.id IS NULL) THEN RAISE EXCEPTION 'Hospedagem sem reserva de origem'; END IF;
 IF EXISTS (SELECT 1 FROM transactions t LEFT JOIN transactions o ON o.id=t."reversalOfId" WHERE t."reversalOfId" IS NOT NULL AND o.id IS NULL) THEN RAISE EXCEPTION 'Estorno sem origem'; END IF;
END $$;
SELECT 'Saldos, compras, títulos, hospedagens e estornos reconciliados' AS recovery_result;
