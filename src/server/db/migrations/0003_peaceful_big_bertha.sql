CREATE TABLE "barber_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" text NOT NULL,
	"service_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "barber_services_member_service_uniq" UNIQUE("member_id","service_id")
);
--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "canCreateServices" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "barber_services" ADD CONSTRAINT "barber_services_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_services" ADD CONSTRAINT "barber_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "barber_services_member_idx" ON "barber_services" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "barber_services_service_idx" ON "barber_services" USING btree ("service_id");