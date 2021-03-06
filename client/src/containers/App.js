import React, { Component } from "react";
import { Route, Switch, withRouter } from "react-router-dom";
import { connect } from "react-redux";
import Login from "../components/Login";
import Signup from "../components/Signup";
import Profile from "../components/Profile";
import Dashboard from "../components/Dashboard";
import Grommet from "grommet";
import Campaigns from "../components/Campaigns";
import Drop from "../components/dropzone";
import PrivateRoute from "../PrivateRoute";
import { getGroups } from "../actions";
import NewCampaign from "../components/NewCampaign";
import Editor from "../components/Editor.js";
import LandingPage from "../components/LandingPage.js";
import Unsubscribe from "../components/Unsubscribe.js";
import Groups from "../components/Groups.js";
import GroupDetails from "../components/GroupDetails.js";
import NewGroup from "../components/NewGroup.js";
import Auth from "../Auth";
import NotFound from "../components/NotFound";
import ContactUs from "../components/ContactUs.js";
import Data from "../components/datagraph.js";

class App extends Component {
  componentDidMount() {
    this.props.dispatch(getGroups(Auth.userID));
  }

  render() {
    return (
      <Grommet.App centered={false}>
        <Switch>
          <PrivateRoute exact path="/" component={Dashboard} />
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <PrivateRoute path="/profile/:id" component={Profile} />
          <PrivateRoute path="/createCampaign" component={NewCampaign} />
          <PrivateRoute path="/campaigns/:id/edit" component={Editor} />
          <PrivateRoute path="/campaigns/:id" component={Campaigns} />
          <PrivateRoute path="/groups/:id" component={GroupDetails} />
          <PrivateRoute path="/groups" component={Groups} />
          <PrivateRoute path="/createGroup" component={NewGroup} />
          <PrivateRoute path="/drop" component={Drop} />
          <Route path="/about" component={LandingPage} />
          <Route path="/unsubscribe/:id" component={Unsubscribe} />
          <Route path="/contactUs" component={ContactUs} />
          <PrivateRoute path="/data/:id" component={Data} />
          {/* 404 must be last path to match any remaining paths */}
          <Route path="/*" component={NotFound} />
        </Switch>
      </Grommet.App>
    );
  }
}

function mapStateToProps(state) {
  return {
    campaigns: state.campaigns,
    user: state.user,
    contacts: state.contacts,
    groups: state.groups
  };
}

export default withRouter(connect(mapStateToProps)(App));
