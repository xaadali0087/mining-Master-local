import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DefaultLayout from "./components/DefaultLayout";
import Home from "./pages/home/Home";
import Mine from "./pages/mine/Mine";
import Bank from "./pages/bank/Bank";
import "./index.css";
import "./styles.css";
import "./fonts.css";
import Staking from "./pages/staking/Staking";
import Shop from "./pages/shop/Shop";
import Leaderboard from "./pages/leaderboard/Leaderboard";
import ContractDebug from "./pages/debug/ContractDebug";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <DefaultLayout>
              <Home />
            </DefaultLayout>
          }
        />
        <Route
          path="/mine"
          element={
            <DefaultLayout>
              <Mine />
            </DefaultLayout>
          }
        />
        <Route
          path="/bank"
          element={
            <DefaultLayout>
              <Bank />
            </DefaultLayout>
          }
        />
        <Route
          path="/staking"
          element={
            <DefaultLayout>
              <Staking />
            </DefaultLayout>
          }
        />
        <Route
          path="/shop"
          element={
            <DefaultLayout>
              <Shop />
            </DefaultLayout>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <DefaultLayout>
              <Leaderboard />
            </DefaultLayout>
          }
        />
        <Route
          path="/debug"
          element={
            <DefaultLayout>
              <ContractDebug />
            </DefaultLayout>
          }
        />
      </Routes>
    </Router>
  );
}
