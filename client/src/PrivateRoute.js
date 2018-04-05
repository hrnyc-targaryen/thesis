import React from "react";
import { connect } from "react-redux";
import { Route, Redirect } from "react-router-dom";
import Auth from "./Auth";

const fourohfour = "/404";

// TODO: BLATENT--BLATENT, I SAY--VIOLATIONS OF "DRY" PRINCIPLES
const PrivateRoute = ({ component: Component, ...rest }) => {
  let isAllowed = Auth.isAuthenticated;
  let redirectTo = "/about";

  if (rest.path.includes("campaigns/")) {
    console.log("ROUTE INCLUDES CAMPAIGNS");
    // Get the campaignId from the route
    const campaignId = Number(rest.computedMatch.params.id);
    // Check in campaigns if this campaign belongs to the user
    let usersCampaignIds = [];
    for (const camp of rest.campaigns) {
      usersCampaignIds.push(camp.id);
    }
    // If not,
    //   set redirect route to 404
    if (!usersCampaignIds.includes(campaignId)) {
      isAllowed = false;
      redirectTo = fourohfour;
    }
  } else if (rest.path.includes("groups/")) {
    console.log("ROUTE INCLUDES GROUPS");
    // Get the groupId from the route
    const groupId = Number(rest.computedMatch.params.id);
    // Check in campaigns if this campaign belongs to the user
    let usersGroupIds = [];
    for (const camp of rest.campaigns) {
      usersGroupIds.push(camp.id);
    }
    // If not,
    //   set redirect route to 404
    if (!usersGroupIds.includes(groupId)) {
      isAllowed = false;
      redirectTo = fourohfour;
    }
  } else if (rest.path.includes("profile/")) {
    console.log("ROUTE INCLUDES PROFILE");
    // Get the profileId from the route
    const profileId = Number(rest.computedMatch.params.id);
    // Check against Auth.userID
    if (profileId !== Auth.userID) {
      isAllowed = false;
      redirectTo = fourohfour;
    }
  }

  return (
    <Route
      {...rest}
      render={props =>
        isAllowed ? <Component {...props} /> : <Redirect to={redirectTo} />
      }
    />
  );
};

function mapStateToProps(state) {
  return {
    user: state.user,
    campaigns: state.campaigns.campaigns,
    contacts: state.contacts.contacts,
    groups: state.groups.groups,
    allContacts: state.allContacts.allContacts
  };
}

export default connect(mapStateToProps)(PrivateRoute);
