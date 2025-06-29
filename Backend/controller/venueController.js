const venueModel = require("../models/venueModel");
const adminModel = require("../models/adminModel");
const bcrypt = require("bcrypt");
const { generateToken } = require("../utils/generateToken");
const cloudinary = require("../utils/cloudinary");
const nodemailer = require("nodemailer");
require("dotenv").config();
const axios = require("axios");
const eventModel = require("../models/eventModel");
const { formateDate } = require("../utils/helper");
const {
  errorResponse_badRequest,
  errorResponse_catchError,
  successResponse_ok,
  errorResponse_alreadyExists,
} = require("../responseObject");
const { default: mongoose } = require("mongoose");
const userModel = require("../models/userModel");

// Register Venue
module.exports.signUp = async (req, res) => {
  try {
    let {
      venueName,
      owner,
      email,
      contact,
      city,
      fullAddress,
      maxCapacity,
      canOrganizeMultidayEvent,
    } = req.body;

    if (
      venueName &&
      city &&
      email &&
      contact &&
      fullAddress &&
      maxCapacity &&
      (canOrganizeMultidayEvent || !canOrganizeMultidayEvent)
    ) {
      const existingVenue = await venueModel.findOne({ email });
      if (existingVenue) {
        return errorResponse_alreadyExists(res, "Venue already exists!");
      }

      // const apiUrl = `https://api.zerobounce.net/v2/validate?api_key=${
      //   process.env.ZEROBONUS_API_KEY
      // }&email=${encodeURIComponent(email)}`;

      // const response = await axios.get(apiUrl);

      // if (response.data.status === "valid") {

      const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let password = "";
      for (let i = 0; i < 10; i++) {
        password += characters.charAt(
          Math.floor(Math.random() * characters.length)
        );
      }
      let venue = await venueModel.create({
        name: venueName,
        ownerName: owner,
        email,
        temporaryPassword: password,
        contact,
        address: fullAddress,
        city,
        maxCapacity,
        canOrganizeMultidayEvent,
      });

      await adminModel.updateMany({}, { $push: { appliedVenues: venue._id } });

      return successResponse_ok(
        res,
        "You have successfully applied for Registering your Venue",
        venue
      );
      // } else {
      // res.send("Email Address doesn't exists!! Please enter a valid Email Address.")
      // }
    } else {
      return errorResponse_badRequest(res);
    }
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Upload venue Profile Picture
module.exports.uploadVenueProfilePicture = async (req, res) => {
  try {
    const image = req.body.image;
    const oldImage = req.venue.profilepicture
      ? req.venue.profilepicture.public_id
      : null;

    const result = await cloudinary.uploader.upload(image, {
      folder: "eventManagement_venueProfilePicture",
      width: 300,
      crop: "scale",
    });

    const venue = await venueModel.updateOne(
      { email: req.venue.email },
      {
        $set: {
          profilepicture: {
            public_id: result.public_id,
            url: result.secure_url,
          },
        },
      }
    );

    if (oldImage) {
      await cloudinary.uploader.destroy(oldImage);
    }
    return successResponse_ok(res, "File uploaded successfully", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Login
module.exports.loginVenue = async (req, res) => {
  try {
    let token = req.cookies.token;

    if (token) {
      res.send("You are already logged in.");
    } else {
      let { email, password } = req.body;
      if (email && password) {
        let venue = await venueModel.findOne({ email });

        if (venue) {
          if (venue.password) {
            bcrypt.compare(password, venue.password, async (err, result) => {
              if (result) {
                let token = generateToken(venue);
                res.cookie("token", token, {
                  httpOnly: true,
                  secure: false,
                  sameSite: "Lax",
                  path: "/",
                });
                return successResponse_ok(res, "Login successfull");
              } else {
                return res.send({ success: false, message: "Wrong Password" });
              }
            });
          } else if (venue.temporaryPassword == password) {
            let token = generateToken(venue);
            res.cookie("token", token, {
              httpOnly: true,
              secure: false,
              sameSite: "Lax",
              path: "/",
            });

            return successResponse_ok(res, "Login successfull");
          } else {
            return res.send({ success: false, message: "Wrong Password" });
          }
        } else {
          return res.send({
            success: false,
            message: "Email or Password is wrong",
          });
        }
      } else {
        return errorResponse_badRequest(res);
      }
    }
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Logout
module.exports.logoutVenue = async (req, res) => {
  try {
    res.cookie("token", "", {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      path: "/",
    });
    res.send("Logout successfully");
  } catch (err) {
    console.log(err.message);
    res.send("Internal Server Error");
  }
};

// Update Password
module.exports.updatePasswordFirstTime = async (req, res) => {
  try {
    let { venueId, password } = req.body;

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    let venue = await venueModel.updateOne(
      { _id: venueId },
      { $set: { password: hashedPassword, temporaryPassword: null } }
    );

    if (venue) {
      return successResponse_ok(res, "Password Updated Successfully", null);
    }
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Fetch Venue User
module.exports.fetchVenueUser = async (req, res) => {
  try {
    let venue = req.venue;

    await venue.populate([
      {
        path: "bookingRequests.id",
        model: "event",
        populate: { path: "ownerId" },
      },
    ]);

    if (venue.bookings && venue.bookings.length > 0) {
      await venue.populate({
        path: "bookings.eventId",
        model: "event",
      });
    }

    return successResponse_ok(res, "Venue fetched", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall Name
module.exports.updateHallName = async (req, res) => {
  try {
    let { newHallName } = req.body;
    let venue = req.venue;

    venue = await venueModel.findOneAndUpdate(
      { email: venue.email },
      { $set: { name: newHallName } },
      { new: true }
    );
    return successResponse_ok(res, "Hallname updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall Name
module.exports.updateHallDescription = async (req, res) => {
  try {
    let { newHallDescription } = req.body;
    let oldVenue = req.venue;

    let venue = await venueModel.findOneAndUpdate(
      { email: oldVenue.email },
      {
        $set: {
          description: newHallDescription,
          completePercentage: oldVenue.description
            ? oldVenue.completePercentage
            : oldVenue.completePercentage + 10,
        },
      },
      { new: true }
    );
    return successResponse_ok(res, "Hall description updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall City
module.exports.updateHallCity = async (req, res) => {
  try {
    let { newHallCity } = req.body;
    let venue = req.venue;

    venue = await venueModel.findOneAndUpdate(
      { email: venue.email },
      { $set: { city: newHallCity } },
      { new: true }
    );
    return successResponse_ok(res, "Hall City updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall Email
module.exports.updateHallEmail = async (req, res) => {
  try {
    let { newHallEmail } = req.body;
    let venue = req.venue;

    venueModel
      .findOneAndUpdate(
        { email: venue.email },
        { $set: { email: newHallEmail } },
        { new: true }
      )
      .then((response) => {
        res.cookie("token", "", {
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
          path: "/",
        });

        let updatedVenue = { ...response, email: newHallEmail };
        let token = generateToken(updatedVenue);

        res.cookie("token", token, {
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
          path: "/",
        });

        return successResponse_ok(res, "Hall Email updated", updatedVenue._doc);
      })
      .catch((err) => {
        res.send(err.message);
      });
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall Contact
module.exports.updateHallContact = async (req, res) => {
  try {
    let { newHallPhone } = req.body;
    let venue = req.venue;

    venue = await venueModel.findOneAndUpdate(
      { email: venue.email },
      { $set: { contact: newHallPhone } },
      { new: true }
    );
    return successResponse_ok(res, "Hall contact updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall Address
module.exports.updateHallAddress = async (req, res) => {
  try {
    let { newHallAddress } = req.body;
    let venue = req.venue;

    venue = await venueModel.findOneAndUpdate(
      { email: venue.email },
      { $set: { address: newHallAddress } },
      { new: true }
    );
    return successResponse_ok(res, "Hall address updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall Capacity
module.exports.updateHallCapacity = async (req, res) => {
  try {
    let { newHallCapacity } = req.body;
    let venue = req.venue;

    venue = await venueModel.findOneAndUpdate(
      { email: venue.email },
      { $set: { maxCapacity: newHallCapacity } },
      { new: true }
    );
    return successResponse_ok(res, "Hall capacity updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall Multiday
module.exports.updateHallMultiday = async (req, res) => {
  try {
    let { newHallMultiday } = req.body;
    let venue = req.venue;

    venue = await venueModel.findOneAndUpdate(
      { email: venue.email },
      { $set: { canOrganizeMultidayEvent: newHallMultiday } },
      { new: true }
    );
    return successResponse_ok(res, "Hall Multiday Fecility updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall Projector Facility
module.exports.updateHallProjector = async (req, res) => {
  try {
    let { newHallProjector } = req.body;
    let oldVenue = req.venue;

    let venue = await venueModel.findOneAndUpdate(
      { email: oldVenue.email },
      {
        $set: {
          projector: newHallProjector,
          completePercentage: oldVenue.projector
            ? oldVenue.completePercentage
            : oldVenue.completePercentage + 10,
        },
      },
      { new: true }
    );
    return successResponse_ok(res, "Hall Projector Facility updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall Broadband Facility
module.exports.updateHallBroadband = async (req, res) => {
  try {
    let { newHallBroadband } = req.body;
    let oldVenue = req.venue;

    let venue = await venueModel.findOneAndUpdate(
      { email: oldVenue.email },
      {
        $set: {
          broadband: newHallBroadband,
          completePercentage: oldVenue.broadband
            ? oldVenue.completePercentage
            : oldVenue.completePercentage + 10,
        },
      },
      { new: true }
    );
    return successResponse_ok(res, "Hall Broadband Facility updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall timing
module.exports.updateHallTime = async (req, res) => {
  try {
    const {
      time_1stHalf,
      bookingPrice_1stHalf,
      time_2ndHalf,
      bookingPrice_2ndHalf,
      time_fullDay,
      bookingPrice_fullDay,
    } = req.body;
    const { _id } = req.venue;
    const venue = await venueModel.findOneAndUpdate(
      { _id },
      {
        $set: {
          time_1stHalf,
          bookingPrice_1stHalf,
          time_2ndHalf,
          bookingPrice_2ndHalf,
          time_fullDay,
          bookingPrice_fullDay,
        },
      },
      { new: true }
    );

    res
      .status(200)
      .send({ success: true, message: "Venue details updated", data: venue });
  } catch (err) {
    res.send(err.message);
  }
};

// Update Hall type
module.exports.updateHallType = async (req, res) => {
  try {
    let { newHalltype } = req.body;
    let oldVenue = req.venue;

    let venue = await venueModel.findOneAndUpdate(
      { email: oldVenue.email },
      {
        $set: {
          hallType: newHalltype,
          completePercentage: oldVenue.hallType
            ? oldVenue.completePercentage
            : oldVenue.completePercentage + 10,
        },
      },
      { new: true }
    );
    return successResponse_ok(res, "Hall type updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall Opening Time
module.exports.updateHallOpeningTime = async (req, res) => {
  try {
    let { newOpeningTime } = req.body;
    let oldVenue = req.venue;

    let venue = await venueModel.findOneAndUpdate(
      { email: oldVenue.email },
      {
        $set: {
          openingtime: newOpeningTime,
          completePercentage: oldVenue.openingtime
            ? oldVenue.completePercentage
            : oldVenue.completePercentage + 10,
        },
      },
      { new: true }
    );
    return successResponse_ok(res, "Hall opening time updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall Closing Time
module.exports.updateHallClosingTime = async (req, res) => {
  try {
    let { newClosingTime } = req.body;
    let oldVenue = req.venue;

    let venue = await venueModel.findOneAndUpdate(
      { email: oldVenue.email },
      {
        $set: {
          closingtime: newClosingTime,
          completePercentage: oldVenue.closingtime
            ? oldVenue.completePercentage
            : oldVenue.completePercentage + 10,
        },
      },
      { new: true }
    );
    return successResponse_ok(res, "Hall closing time updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall time (1st)
module.exports.updateHall_1stHalfTime = async (req, res) => {
  try {
    let { newHall_1stHalfTime } = req.body;
    let oldVenue = req.venue;

    let venue = await venueModel.findOneAndUpdate(
      { email: oldVenue.email },
      {
        $set: {
          time_1stHalf: newHall_1stHalfTime,
          completePercentage: oldVenue.time_1stHalf
            ? oldVenue.completePercentage
            : oldVenue.completePercentage + 10,
        },
      },
      { new: true }
    );
    return successResponse_ok(res, "Hall 1st half time updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall time (2nd)
module.exports.updateHall_2ndHalfTime = async (req, res) => {
  try {
    let { newHall_2ndHalfTime } = req.body;
    let oldVenue = req.venue;

    let venue = await venueModel.findOneAndUpdate(
      { email: oldVenue.email },
      {
        $set: {
          time_2ndHalf: newHall_2ndHalfTime,
          completePercentage: oldVenue.time_2ndHalf
            ? oldVenue.completePercentage
            : oldVenue.completePercentage + 10,
        },
      },
      { new: true }
    );
    return successResponse_ok(res, "Hall 2nd half time updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall time (full day)
module.exports.updateHall_fullDayTime = async (req, res) => {
  try {
    let { newHall_fullDayTime } = req.body;
    let oldVenue = req.venue;

    let venue = await venueModel.findOneAndUpdate(
      { email: oldVenue.email },
      {
        $set: {
          time_fullDay: newHall_fullDayTime,
          completePercentage: oldVenue.time_fullDay
            ? oldVenue.completePercentage
            : oldVenue.completePercentage + 10,
        },
      },
      { new: true }
    );
    return successResponse_ok(res, "Hall full day time updated", venue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall price (1st)
module.exports.updateHall_1stHalfPrice = async (req, res) => {
  try {
    let { newHall_1stHalfprice } = req.body;
    let oldVenue = req.venue;

    let venue = await venueModel.findOneAndUpdate(
      { email: oldVenue.email },
      {
        $set: {
          bookingPrice_1stHalf: newHall_1stHalfprice,
          completePercentage: oldVenue.bookingPrice_1stHalf
            ? oldVenue.completePercentage
            : oldVenue.completePercentage + 10,
        },
      },
      { new: true }
    );
    return successResponse_ok(
      res,
      "Hall 1st half booking price updated",
      venue
    );
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall price (2nd)
module.exports.updateHall_2ndHalfPrice = async (req, res) => {
  try {
    let { newHall_2ndHalfprice } = req.body;
    let oldVenue = req.venue;

    let venue = await venueModel.findOneAndUpdate(
      { email: oldVenue.email },
      {
        $set: {
          bookingPrice_2ndHalf: newHall_2ndHalfprice,
          completePercentage: oldVenue.bookingPrice_2ndHalf
            ? oldVenue.completePercentage
            : oldVenue.completePercentage + 10,
        },
      },
      { new: true }
    );
    return successResponse_ok(
      res,
      "Hall 2nd half booking price updated",
      venue
    );
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Update Hall price (full day)
module.exports.updateHall_fullDayPrice = async (req, res) => {
  try {
    let { newHall_fullDayprice } = req.body;
    let oldVenue = req.venue;

    venue = await venueModel.findOneAndUpdate(
      { email: oldVenue.email },
      {
        $set: {
          bookingPrice_fullDay: newHall_fullDayprice,
          completePercentage: oldVenue.bookingPrice_fullDay
            ? oldVenue.completePercentage
            : oldVenue.completePercentage + 10,
        },
      },
      { new: true }
    );
    return successResponse_ok(
      res,
      "Hall full day booking price updated",
      venue
    );
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Accept event request
module.exports.acceptEvent = async (req, res) => {
  try {
    const { eventId, timeslot } = req.body;
    const event = await eventModel.findOne({ _id: eventId });
    let venue = req.venue;
    let amount;
    if (timeslot === "1") {
      amount = venue.bookingPrice_1stHalf;
    } else if (timeslot === "2") {
      amount = venue.bookingPrice_2ndHalf;
    } else if (timeslot === "F") {
      amount = venue.bookingPrice_fullDay;
    }
    const oldRequestedVenues = event.requestedVenues;
    const slot =
      timeslot === "1"
        ? venue.time_1stHalf
        : timeslot === "2"
          ? venue.time_2ndHalf
          : timeslot === "F"
            ? venue.time_fullDay
            : null;
    if (event) {
      event.finalVenueDeatails = venue._id;
      event.finalVenueSlot = `${timeslot}+${slot}`;
      event.bill = amount;
      await event.save();
    }
    const existingVenue = await venueModel.findById(venue._id);
    const eventDate = new Date(event.date).toISOString().split("T")[0];

    let updatedBookings = [...existingVenue.bookings];
    let bookingIndex = updatedBookings.findIndex(
      (b) => new Date(b.date).toISOString().split("T")[0] === eventDate
    );

    if (bookingIndex !== -1) {
      let existingSlot = updatedBookings[bookingIndex].slot;
      if (
        (existingSlot === "1" && timeslot === "2") ||
        (existingSlot === "2" && timeslot === "1")
      ) {
        updatedBookings[bookingIndex].slot = "F";
      }
    } else {
      updatedBookings.push({ eventId, date: event.date, slot: timeslot });
    }

    await venueModel.findByIdAndUpdate(
      venue._id,
      { bookings: updatedBookings },
      { new: true }
    );

    await Promise.all(
      oldRequestedVenues.map(async (request) => {
        const venue = await venueModel.findOne({ _id: request.id });
        const updatedBookingRequests = venue?.bookingRequests.filter(
          (booking) => {
            return booking.id.toString() !== eventId.toString();
          }
        );
        await venueModel.findOneAndUpdate(
          { _id: request.id },
          {
            $set: {
              bookingRequests: updatedBookingRequests,
            },
          }
        );
      })
    );

    event.requestedVenues = [];
    await event.save();
    const updatedVenue = await venueModel.findById(venue._id);
    if (updatedVenue.bookings && updatedVenue.bookings.length > 0) {
      await updatedVenue.populate({
        path: "bookings.eventId bookingRequests.id",
        model: "event",
      });
    }

    return successResponse_ok(res, "Event Accepted", updatedVenue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};

// Reject event request
module.exports.rejectEvent = async (req, res) => {
  try {
    const { eventId } = req.body;
    let venue = req.venue;
    let event = await eventModel.findOneAndUpdate(
      { _id: eventId },
      { $addToSet: { rejectedVenueRequests: eventId } }
    );
    event = await eventModel.findById(eventId);
    event.requestedVenues = event.requestedVenues.filter(
      (venueReq) => venueReq.id.toString() !== venue._id
    );
    await event.save();

    venue = await venueModel.findById(venue._id);
    const updatedBookingRequests = venue.bookingRequests.filter((request) => {
      return request.id.toString() !== eventId.toString();
    });
    const updatedVenue = await venueModel.findOneAndUpdate(
      { _id: venue._id },
      { $set: { bookingRequests: updatedBookingRequests } },
      { new: true }
    );

    const user = await userModel.findOne({ _id: event.ownerId })
    console.log('user', user)
   
    const testAccount = await nodemailer.createTestAccount();
    
        const transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          auth: {
            user: process.env.user,
            pass: process.env.pass,
          },
        });
    
     await transporter.sendMail({
      from: venue.email,
      to: user.email,
      subject: "Venue Request Rejected",
      html: `<body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f9f9f9; color: #333;">
         <div style="margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); border: 1px solid #ddd;">
             <div style="background-color: #f6440e; color: #ffffff; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
                 <h2 style="margin: 0;">Venue Request Rejected</h2>
             </div>
             <div style="padding: 20px;">
                 <p>Dear ${user.username},</p>
                 <p>We regret to inform you that your requested venue ${venue.name} has been <strong>rejected</strong> for the event ${event.eventName} after careful review. Unfortunately, it did not meet all the necessary criteria for approval.</p>
                 <p>Thank you for your interest in our platform. We appreciate the effort you put into your application and hope to see you again in the future.</p>
             </div>
             <div style="margin-top: 20px; font-size: 14px; color: #777; text-align: center; padding: 10px 0; border-top: 1px solid #ddd;">
                 <p>Warm regards,<br>The Eventek Team</p>
                 <p><i>Your success is our priority.</i></p>
             </div>
         </div>
     </body>`,
    });

    if (event.rejectedVenueRequests === 3) {
      updatedVenue.allvenueRejected = true;
      await updatedVenue.save();
      
      const venue1 = await event.rejectedVenueRequests[0].populate();
      const venue2 = await event.rejectedVenueRequests[1].populate();
      const venue3 = await event.rejectedVenueRequests[2].populate();
       
      event.rejectedVenueRequests = [];
      await event.save();
    }
    await updatedVenue.populate([
      {
        path: "bookingRequests.id",
        model: "event",
        populate: { path: "ownerId" },
      },
    ]);
    return successResponse_ok(res, "Event Rejected", updatedVenue);
  } catch (err) {
    return errorResponse_catchError(res, err.message);
  }
};
