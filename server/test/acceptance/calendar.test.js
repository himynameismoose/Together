/* eslint-env jest */

const request = require("supertest");
const express = require("express");
const calendarRoute = require("../../routes/calendar");
const Event = require("../../models/Event");

// mock the event model
jest.mock("../../models/Event", () => ({
  find: jest.fn(),
}));

// mock ics library
jest.mock("ics", () => ({
  createEvents: jest.fn((events) => {
    // check for null title
    if (events.some((e) => !e.start || !e.end || !e.title)) {
      return { error: new Error("Invalid event data"), value: null };
    }

    // This is a minimal mock that returns the expected data for our test
    const icsString = events
      .map(
        (event) =>
          `BEGIN:VEVENT\nSUMMARY:${event.title}\nLOCATION:${event.location}\nEND:VEVENT`
      )
      .join("\n");

    return {
      error: null,
      value: `BEGIN:VCALENDAR\n${icsString}\nEND:VCALENDAR`,
    };
  }),
}));

describe("GET /calendar.ics", () => {
  let app;

  beforeAll(() => {
    // Set up a simple Express app for testing purposes
    app = express();
    app.use("/", calendarRoute); // Mount the calendar router
  });

  // Reset all mocks after each test to ensure test isolation
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("return a 200 status and an iCalendar file with events", async () => {
    // Mock a successful database query result with valid Date objects
    const mockEvents = [
      {
        _id: "12345",
        title: "Together Event",
        description: "A test event.",
        location: "Together HQ",
        startAt: new Date("2025-01-01T10:00:00Z"),
        endAt: new Date("2025-01-01T12:00:00Z"),
      },
    ];

    // Mock the find().lean() chain
    Event.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockEvents),
    });

    // Make the request and test the response
    const res = await request(app).get("/calendar.ics");

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/calendar");
    expect(res.headers["content-disposition"]).toBe(
      'inline; filename="together-calendar.ics"'
    );
    expect(res.text).toContain("BEGIN:VCALENDAR");
    expect(res.text).toContain("END:VCALENDAR");
    expect(res.text).toContain("SUMMARY:Together Event");
    expect(res.text).toContain("LOCATION:Together HQ");

    // Verify the mock function was called correctly
    expect(Event.find).toHaveBeenCalledTimes(1);
  });

  it("returns a 500 status if the database query fails", async () => {
    // Mock the database query to throw an error
    Event.find.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error("Database error")),
    });

    const res = await request(app).get("/calendar.ics");

    expect(res.statusCode).toBe(500);
    expect(res.text).toBe("Sever Error");
  });

  it("return a 500 status if ics.createEvents throws an error", async () => {
    // Mock the find().lean() chain with a valid date but an invalid title
    // This data will pass `createDateArray` function but cause mock `ics` library to fail
    const mockEvents = [
      {
        _id: "12345",
        title: null, // A null title will cause the `ics` mock to return an error
        startAt: new Date(),
        endAt: new Date(),
      },
    ];

    Event.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockEvents),
    });

    const res = await request(app).get("/calendar.ics");

    expect(res.statusCode).toBe(500);
    expect(res.text).toBe("Error generating calendar feed.");
  });
});
