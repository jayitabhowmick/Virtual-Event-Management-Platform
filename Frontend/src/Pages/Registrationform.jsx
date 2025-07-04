import { useState, useEffect } from "react";
import { findUser, fetchSingleEvent, eventRegistration } from "../utils/utils";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useUser } from "../context/userContext/UserContext";

const Registrationform = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [paymentDone, setpaymentDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const { setUser } = useUser();

  const [formdata, setformdata] = useState({
    Name: "",
    PhoneNo: "",
    Emailid: "",
    EventName: "",
    EventDate: "",
    Venue: "",
    Pay: false,
    scannerImage: "",
    payAmount: 0,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formdata.Pay) {
        const { data } = await axios.post(
          "http://localhost:8000/users/create-order",
          {
            amount: Number(formdata.payAmount),
            currency: "INR",
            receipt: "receipt#1",
            notes: {},
          },
          { withCredentials: true }
        );

        const options = {
          key: "rzp_test_B9RwKdpPVSHcZx",
          amount: data.order.amount,
          currency: data.order.currency,
          name: "abc",
          description: "abcd",
          order_id: data.order.id,
          handler: async (response) => {
            let verifyResponse = await axios.post(
              "http://localhost:8000/users/verify-payment",
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
              { withCredentials: true }
            );
            if (verifyResponse.data.success) {
              setLoading(true);
              eventRegistration(eventId).then((response) => {
                setLoading(false);
                alert(response.message);
                if (response.success) {
                  sessionStorage.setItem("user", JSON.stringify(response.data));
                  setUser(response.data);
                  navigate(`/eventpage/${eventId}`);
                }
              });
            } else {
              alert("Failed to register!");
            }
          },
          prefill: {
            name: "Rahul Jha",
            email: "rahul@gmail.com",
            contact: "9999999999",
          },
          theme: {
            color: "#F37254",
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        setLoading(true);
        eventRegistration(eventId).then((response) => {
          setLoading(false);
          alert(response.message);
          if (response.success) {
            navigate(`/eventpage/${eventId}`);
          }
        });
      }
    } catch (err) {
      console.log("err", err);
    }
  };

  useEffect(() => {
    findUser().then((user) => {
      fetchSingleEvent(eventId).then((response) => {
        if (response.success) {
          const event = response.data;
          setformdata({
            ...formdata,
            Emailid: user.email,
            PhoneNo: user.contact,
            Name: user.username,
            EventName: event.eventName,
            EventDate: new Date(event.date).toLocaleDateString("en-GB"),
            Pay: event.isPaid,
            paidAmount: event.payableAmount ? event.payableAmount : 0,
            scannerImage: event.scannerImage ? event.scannerImage.url : null,
            payAmount: event.payableAmount ? event.payableAmount : null,
          });
        }
      });
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 m-12 rounded-lg shadow-lg w-11/12 md:w-3/4 lg:w-2/3 xl:w-[90%]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="w-full lg:w-full">
            <h2 className="font-serif text-3xl sm:text-3xl font-bold text-indigo-600 mb-6 sm:mb-8">
              Register Yourself
            </h2>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Name */}
              <div>
                <label
                  htmlFor="Name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="Name"
                  id="Name"
                  placeholder={formdata.Name}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                  disabled
                />
              </div>

              {/* Phone Number */}
              <div>
                <label
                  htmlFor="PhoneNo"
                  className="block text-sm font-medium text-gray-700"
                >
                  Your Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="numeric"
                  name="PhoneNo"
                  id="PhoneNo"
                  placeholder={formdata.PhoneNo}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                  disabled
                />
              </div>

              {/* Email ID */}
              <div>
                <label
                  htmlFor="Emailid"
                  className="block text-sm font-medium text-gray-700"
                >
                  Your Email ID <span className="text-red-500">*</span>
                </label>
                <input
                  name="Emailid"
                  id="Emailid"
                  placeholder={formdata.Emailid}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                  disabled
                />
              </div>

              {/* Event Name */}
              <div>
                <label
                  htmlFor="EventName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Event Name
                </label>
                <input
                  name="EventName"
                  id="eventName"
                  placeholder={formdata.EventName}
                  className="mt-1 block w-full p-2 "
                  disabled
                />
              </div>

              {/* Event Date */}
              <div>
                <label
                  htmlFor="EventDate"
                  className="block text-sm font-medium text-gray-700"
                >
                  Event Date
                </label>
                <input
                  name="EventDate"
                  id="EventDate"
                  placeholder={formdata.EventDate}
                  className="mt-1 block w-full p-2 "
                  disabled
                />
              </div>

              {/*Payment */}
              {/* {formdata.Pay && !paymentDone && (
                <div className="w-[90%] flex justify-center items-center flex-col">
                  <div
                    className="mt-2 ml-8 bg-red-500 text-white p-2 rounded-md hover:bg-red-600 cursor-pointer"
                    onClick={() => setModalOpen(true)}
                  >
                    Pay Now &emsp; {formdata.paidAmount}/-
                  </div>

                  {modalOpen && (
                    <div
                      style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        zIndex: 999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          backgroundColor: "white",
                          padding: "20px 0px 20px 20px",
                          borderRadius: "8px",
                          textAlign: "center",
                          width: "300px",
                        }}
                      >
                        <button
                          style={{
                            position: "absolute",
                            top: "10px",
                            right: "10px",
                            background: "none",
                            border: "none",
                            fontSize: "20px",
                            cursor: "pointer",
                          }}
                          onClick={() => setModalOpen(false)}
                        >
                          &times;
                        </button>

                        <img
                          src={formdata.scannerImage}
                          alt="Scanner"
                          style={{
                            width: "200px",
                            height: "200px",
                            marginBottom: "20px",
                          }}
                        />
                        <div className="text-2xl">
                          <strong>Rs.{formdata.payAmount}/-</strong>
                        </div>
                        <button
                          className="bg-red-500 text-white p-2 rounded-md hover:bg-red-600 cursor-pointer mt-5 pl-10 pr-10"
                          onClick={() => {
                            setpaymentDone(true);
                            setModalOpen(false);
                            alert("Payment successful");
                          }}
                        >
                          Pay
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {formdata.Pay && paymentDone && (
                <div className="w-[90%] flex justify-center items-center flex-col">
                  <div className="mt-2 ml-8 bg-green-500 text-white p-2 rounded-md font-bold">
                    Payment Done
                  </div>
                </div>
              )} */}

              {/* Register Button */}
              <div className="mt-8 text-center">
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 transition duration-300"
                >
                  Register
                </button>
              </div>
            </form>
          </div>

          {/* Right Part*/}
          <div className="hidden lg:block relative">
            <div
              className="relative overflow-hidden w-full h-full rounded-lg shadow-lg"
              style={{
                clipPath:
                  "polygon(25% 0%, 100% 0%, 100% 100%, 25% 100%, 0% 50%)",
              }}
            >
              <div
                className="relative overflow-hidden w-full h-full rounded-lg shadow-lg"
                style={{
                  clipPath:
                    "polygon(25% 0%, 100% 0%, 100% 100%, 25% 100%, 0% 50%)",
                }}
              >
                <video
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                >
                  <source
                    src="https://media.istockphoto.com/id/1458453396/video/businesswoman-discussing-during-online-meeting.mp4?s=mp4-640x640-is&k=20&c=mrlsdshP3PEHUuD01efcqUwgmnVWaA8nIiz3mgFZcnA="
                    type="video/mp4"
                  />
                </video>
              </div>
            </div>
          </div>
        </div>
        {loading && (
          <>
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                zIndex: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div className="loader"></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Registrationform;
