-- Bookings now record how many participants are expected, not who.
ALTER TABLE "activities" ADD COLUMN "participantCount" INTEGER;
