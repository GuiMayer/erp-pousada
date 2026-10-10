BEGIN;
ALTER TABLE reservations ADD COLUMN "groupId" text;
ALTER TABLE accounts_receivable ADD COLUMN "sourceStayId" text UNIQUE, ADD COLUMN "paidValue" numeric(12,2) NOT NULL DEFAULT 0;
CREATE TABLE stays (
 id text PRIMARY KEY, "reservationId" text NOT NULL UNIQUE REFERENCES reservations(id),
 "payerId" text REFERENCES customers(id), "guestName" text NOT NULL, "guestCount" int,
 "roomId" int NOT NULL REFERENCES rooms(id), "checkIn" timestamp NOT NULL, "checkOut" timestamp NOT NULL,
 status text NOT NULL DEFAULT 'active', "lodgingValue" numeric(12,2) NOT NULL CHECK ("lodgingValue" >= 0),
 "nightlyPrices" jsonb, "recordVersion" int NOT NULL DEFAULT 0, "endedAt" timestamp, "groupId" text
);
CREATE INDEX stays_room_status ON stays("roomId",status);
CREATE INDEX stays_payer_status ON stays("payerId",status);
CREATE UNIQUE INDEX stays_active_room ON stays("roomId") WHERE status = 'active';
CREATE TABLE stay_occupants (id text PRIMARY KEY, "stayId" text NOT NULL REFERENCES stays(id) ON DELETE CASCADE, "customerId" text REFERENCES customers(id), name text NOT NULL);
CREATE TABLE stay_allocations (id text PRIMARY KEY, "stayId" text NOT NULL REFERENCES stays(id) ON DELETE CASCADE, "roomId" int NOT NULL REFERENCES rooms(id), start timestamp NOT NULL, "end" timestamp NOT NULL, reason text, CHECK ("end" >= start));
CREATE INDEX allocations_room_period ON stay_allocations("roomId",start,"end");
CREATE TABLE stay_charges (id text PRIMARY KEY, "stayId" text NOT NULL REFERENCES stays(id) ON DELETE CASCADE, "productId" text REFERENCES pos_products(id), label text NOT NULL, "unitPrice" numeric(12,2) NOT NULL CHECK ("unitPrice" >= 0), quantity int NOT NULL CHECK (quantity > 0), status text NOT NULL DEFAULT 'active', reason text, "createdAt" timestamp NOT NULL DEFAULT now());
CREATE TABLE stay_payments (id text PRIMARY KEY, "stayId" text NOT NULL REFERENCES stays(id) ON DELETE CASCADE, value numeric(12,2) NOT NULL CHECK (value > 0), bucket text NOT NULL, method text NOT NULL, "transactionId" text UNIQUE REFERENCES transactions(id), "createdAt" timestamp NOT NULL DEFAULT now());
ALTER TABLE accounts_receivable ADD CONSTRAINT ar_stay_origin FOREIGN KEY ("sourceStayId") REFERENCES stays(id);
ALTER TABLE accounts_receivable ADD CONSTRAINT ar_paid_bounds CHECK ("paidValue" >= 0 AND "paidValue" <= value);

-- Preserve known reservations and payments; unknown occupants/pricing stay unknown.
INSERT INTO stays (id,"reservationId","payerId","guestName","guestCount","roomId","checkIn","checkOut",status,"lodgingValue","nightlyPrices","endedAt")
 SELECT 'legacy-stay-'||r.id,r.id,r."payerId",r."guestName",r."guestCount",r."roomId",r."checkIn",r."checkOut",CASE WHEN r.status='checkin' THEN 'active' ELSE 'closed' END,r."totalValue",r."nightlyPrices",CASE WHEN r.status='checkout' THEN r."checkOut" ELSE NULL END
 FROM reservations r WHERE r.status IN ('checkin','checkout');
INSERT INTO stay_occupants(id,"stayId","customerId",name)
 SELECT 'legacy-occupant-'||s.id,s.id,g."customerId",s."guestName" FROM stays s JOIN reservations r ON r.id=s."reservationId" JOIN guest_profiles g ON g.cpf=r.cpf;
INSERT INTO stay_allocations(id,"stayId","roomId",start,"end") SELECT 'legacy-allocation-'||id,id,"roomId","checkIn","checkOut" FROM stays;
INSERT INTO stay_payments(id,"stayId",value,bucket,method)
 SELECT 'legacy-payment-'||s.id,s.id,r."paidValue",'lodging','recebimento legado' FROM stays s JOIN reservations r ON r.id=s."reservationId" WHERE r."paidValue">0;
-- Existing consumption has no reliable product ID: retain labels; never repeat stock.
INSERT INTO stay_charges(id,"stayId",label,"unitPrice",quantity)
 SELECT i.id,s.id,i.label,i."unitPrice",i.quantity FROM room_consumption_items i JOIN room_consumptions c ON c.id=i."consumptionId" JOIN stays s ON s."roomId"=c."roomId" AND s.status='active';
CREATE TRIGGER erp_version BEFORE UPDATE ON stays FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON stays FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('stays');
COMMIT;
