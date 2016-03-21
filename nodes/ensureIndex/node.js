output = function() {
  $.db.ensureIndex($.options,
    function(err) {
    if(err) {
      output({error: err});
    } else {
      output({db: $.db});
    }
  });
};
