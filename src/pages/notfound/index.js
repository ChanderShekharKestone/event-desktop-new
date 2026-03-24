import { Link } from "react-router-dom";
import { Container, Typography, Button, Grid } from "@mui/material";

const NotFound = () => {
  return (
    <Container
      component="main"
      maxWidth="xs"
      sx={{ textAlign: "center", mt: 8, mb: 4 }}
    >
      <Grid container spacing={2} direction="column" alignItems="center">
        <Grid item>
          {/* <NotFoundSvg style={{ width: "100%", maxWidth: "400px" }} /> */}
        </Grid>
        <Grid item>
          <Typography
            variant="h1"
            component="h1"
            color="error"
            sx={{ fontSize: "10rem", fontWeight: "bold" }}
          >
            404
          </Typography>
        </Grid>
        <Grid item>
          <Typography
            variant="h5"
            component="h2"
            color="textSecondary"
            gutterBottom
          >
            Oops! Page Not Found
          </Typography>
          <Typography variant="body1" color="textSecondary">
            We couldn’t find the page you’re looking for.
          </Typography>
        </Grid>
        <Grid item>
          <Button
            variant="contained"
            color="primary"
            component={Link}
            to="/"
            sx={{ mt: 3 }}
          >
            Go to Home
          </Button>
        </Grid>
      </Grid>
    </Container>
  );
};

export default NotFound;
