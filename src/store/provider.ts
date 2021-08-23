import onboardConfig from "@/configs/onboard";
import { APP_ZKSYNC_BLOCK_EXPLORER } from "@/plugins/build";
import Onboard from "bnc-onboard";
import { API, Ens, Subscriptions, UserState, Wallet as OnboardWallet } from "bnc-onboard/dist/src/interfaces";

import { actionTree, getterTree, mutationTree } from "typed-vuex";
import { Address } from "zksync/build/types";

function getNameFromAddress(userAddress: Address): string {
  const walletName: string = window.localStorage.getItem(userAddress) || "";
  if (walletName.trim().length > 1 && walletName !== userAddress) {
    return walletName;
  }
  return userAddress.substr(0, 5) + "..." + userAddress.substr(userAddress.length - 5, userAddress.length - 1);
}

export declare type tProviderState = "ready" | "selectWallet" | "checkWallet" | "connecting" | "authorized";

export const state = () => ({
  onboard: Onboard({
    ...onboardConfig,
    subscriptions: <Subscriptions>{
      address: (address: string): void => {
        console.log("subscription: address", address);
      },
      ens: (ens: Ens): void => {
        console.log("subscription: ens", ens);
      },
      network: (networkId: number): void => {
        console.log("subscription: network", networkId);
      },
      balance: (balance: string): void => {
        console.log("subscription: balance", balance);
      },
      wallet: (wallet: OnboardWallet): void => {
        console.log("subscription: wallet", wallet);
      },
    },
  }) as API,
  accountName: <string>"",
  authStep: <tProviderState>"ready",
  selectedWallet: localStorage.getItem("onboardSelectedWallet") || undefined,
  loadingHint: "",
});

export type ProviderModuleState = ReturnType<typeof state>;

export const mutations = mutationTree(state, {
  setAuthStage(state, currentStep: tProviderState) {
    console.log("auth step:", currentStep);
    state.authStep = currentStep;
  },
  storeSelectedWallet(state, selectedWallet: string | undefined) {
    localStorage.setItem("onboardSelectedWallet", selectedWallet as string);
    if (selectedWallet === undefined) {
      localStorage.removeItem("onboardSelectedWallet");
    }
    state.selectedWallet = selectedWallet;
    state.selectedWallet = selectedWallet;
  },
  setLoadingHint(state, text: string) {
    state.loadingHint = text;
  },
  setName(state, name?: string): void {
    const currentAddress = state.onboard.getState().address;
    if (currentAddress) {
      if (!name) {
        if (!state.accountName) {
          name = window.localStorage.getItem(currentAddress) as string;
        }
        name = getNameFromAddress(currentAddress);
        window.localStorage.removeItem(currentAddress);
      }
      window.localStorage.setItem(currentAddress, name);
      state.accountName = getNameFromAddress(currentAddress);
    }
  },
});

export const getters = getterTree(state, {
  loggedIn: (state) => {
    const authState = state.onboard.getState();
    return authState.address !== undefined && authState.wallet.provider !== undefined;
  },
  selectedWallet: (state) => state.selectedWallet,
  name: (state): string | undefined => state.accountName,
  loader: (state) => state.authStep === "connecting",
  address: (state) => (state.onboard!.getState().address.length ? (state.onboard!.getState().address as Address) : undefined),
  loadingHint: (state): string => state.loadingHint,
  zkScanUrl: (state): string | undefined => (state.onboard.getState().address ? `${APP_ZKSYNC_BLOCK_EXPLORER}/accounts/${state.onboard.getState().address}` : undefined),
});

export const actions = actionTree(
  { state, getters, mutations },
  {
    authState({ state, commit }): UserState {
      const accountState = state.onboard.getState();
      commit("setName", undefined);
      console.log("current account state", accountState);
      return accountState;
    },

    async walletSelect({ state, commit }): Promise<boolean> {
      const storedWallet = state.onboard.getState();
      console.log(storedWallet);
      /* const storedSelectedWallet = state.selectedWallet as string | undefined;
       const result = await ((await dispatch("getOnboard")) as API).walletSelect(storedSelectedWallet); */
      const result = await state.onboard.walletSelect();
      if (result) {
        commit("setAuthStage", "selectWallet");
      }
      return result;
    },

    async walletCheck({ state, commit, dispatch }): Promise<boolean> {
      commit("setAuthStage", "connecting");
      commit("setLoadingHint", "Follow the instructions in your Ethereum wallet");
      let checkStatus = false;
      try {
        checkStatus = await state.onboard.walletCheck();
      } catch (e) {
        console.error(e);
      }
      if (checkStatus) {
        commit("setAuthStage", "authorized");
      } else {
        dispatch("reset");
      }
      return checkStatus;
    },

    async accountSelect({ state, commit }): Promise<boolean> {
      const result = await state.onboard.accountSelect();
      if (result) {
        commit("setAuthStage", "connecting");
      }
      return result;
    },

    reset({ state, commit }) {
      console.log("reset called");
      state.onboard.walletReset();
      commit("setAuthStage", "ready");
    },

    processWrongNetwork({ state, commit }) {
      commit("setAuthStage", "connecting");
    },

    async login({ state, dispatch, commit }, forceReset = false): Promise<UserState> {
      if (state.authStep === "authorized") {
        console.log("authorized");
        return dispatch("authState");
      }
      if (forceReset) {
        alert("forced");
        await dispatch("reset");
      }
      console.log("before wallet select");
      if (!["checkWallet", "accountSelect", "authorized", "connecting"].includes(state.authStep as string)) {
        console.log("wallet select required");
        dispatch("authState");
        const selectResult: boolean = await dispatch("walletSelect");
        if (!selectResult) {
          await dispatch("reset");
          return dispatch("authState");
        }
      }
      console.log("before check wallet");
      //      if (state.authStep !== "checkWallet") {
      const checkResult: boolean = await dispatch("walletCheck");
      dispatch("authState");
      if (!checkResult) {
        await dispatch("reset");
        return dispatch("authState");
      }
      //      }
      console.log("before auth state");
      const authState: UserState = await dispatch("authState");
      if (authState.wallet!.type === "hardware") {
        console.log("special call for the hardware wallet");
        const accountSelection: boolean = await dispatch("accountSelect");
        dispatch("authState");
        if (!accountSelection) {
          await dispatch("reset");
          return dispatch("authState");
        }
      }
      return await dispatch("authState");
    },
  },
);