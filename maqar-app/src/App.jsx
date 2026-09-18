import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Nav from "./components/Nav.jsx";
import Toast from "./components/Toast.jsx";
import Modal from "./components/Modal.jsx";
import Home from "./screens/Home.jsx";
import Detail from "./screens/Detail.jsx";
import Booking from "./screens/Booking.jsx";
import Login from "./screens/Login.jsx";
import UserDash from "./screens/UserDash.jsx";
import HostDash from "./screens/HostDash.jsx";
import HostListRoom from "./screens/HostListRoom.jsx";
import Messages from "./screens/Messages.jsx";
import Pay from "./screens/Pay.jsx";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  const { key } = useLocation();
  return (
    <>
      <ScrollToTop />
      <Nav />
      <main key={key} className="animate-screenIn">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:id" element={<Detail />} />
          <Route path="/book/:id" element={<Booking />} />
          <Route path="/login" element={<Login />} />
          <Route path="/me" element={<UserDash />} />
          <Route path="/host" element={<HostDash />} />
          <Route path="/host/new" element={<HostListRoom />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:roomId" element={<Messages />} />
          <Route path="/pay/:bookingId" element={<Pay />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Toast />
      <Modal />
    </>
  );
}
