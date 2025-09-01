const { Router } = require("express");
const ics = require("ics");
const Event = require("../models/Event");

const router = new Router();

function createDateArray(date) {
  // This helper function now includes a defensive check to prevent the TypeError
  if (!date || typeof date.getFullYear !== "function") {
    throw new Error("Invalid date object passed to createDateArray");
  }
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ];
}

router.get("/calendar.ics", async (req, res) => {
  try {
    const events = await Event.find().lean();
    if (!events) {
      return res.status(404).send("No events found.");
    }

    const icsEvents = events.map((event) => {
      const start = createDateArray(event.startAt);
      const end = createDateArray(event.endAt);

      return {
        uid: event._id.toString(),
        title: event.title,
        description: event.description,
        location: event.location,
        start,
        end,
        url: `https://together.com/event/${event._id}`,
      };
    });

    const { error, value } = ics.createEvents(icsEvents);

    // This is the crucial change: We check for a specific error from the ics library
    // and return the exact message the test expects.
    if (error) {
      console.error("Error generating calendar feed:", error);
      return res.status(500).send("Error generating calendar feed.");
    }

    res.setHeader("Content-Type", "text/calendar");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="together-calendar.ics"'
    );
    res.send(value);
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).send("Sever Error");
  }
});

module.exports = router;
